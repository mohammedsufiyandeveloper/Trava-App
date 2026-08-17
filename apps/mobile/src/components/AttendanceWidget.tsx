import React, { useState, useEffect, forwardRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, Linking } from 'react-native';
import BlurView from './BlurView';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONTS } from '../constants/theme';
import { haptics } from '../services/haptics';
import { getTodayAttendance, submitCheckIn, submitCheckOut, getWorkspaces, getTeamAttendance, getCachedSession } from '../services/api';

import { useWorkspace } from '../context/WorkspaceContext';
import ConfirmationSheet from './ConfirmationSheet';

interface Props {
  workspaceId: string;
  variant?: "full" | "mini";
  onLongPress?: () => void;
}

const AttendanceWidget = forwardRef<any, Props>(({ workspaceId, variant = "full", onLongPress }, ref) => {
  const { colors, isDark } = useTheme();
  const { activeWorkspace, todayAttendance, teamAttendance, setTodayAttendance, setTeamAttendance } = useWorkspace();

  // Derive isAdmin directly from the context role
  const role = activeWorkspace?.workspaceRole;
  const isAdmin = role === "ADMIN" || role === "OWNER";

  // Initialize loading based on whether data has already been pre-fetched by WorkspaceContext
  const [loading, setLoading] = useState(() => {
    const isPersonalLoaded = todayAttendance !== undefined;
    const isTeamLoaded = !isAdmin || teamAttendance !== undefined;
    return !(isPersonalLoaded && isTeamLoaded);
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'personal' | 'team'>('personal');
  const [checkOutSheetVisible, setCheckOutSheetVisible] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  // Derive attendance from todayAttendance in context
  const attendance = todayAttendance;

  // Derive team stats dynamically from teamAttendance in context
  const getTeamStats = (teamData: any[] | undefined) => {
    if (!teamData) return null;
    return {
      total: teamData.length,
      present: teamData.filter((r: any) => !!r.attendance?.checkIn).length,
      late: teamData.filter((r: any) => {
        if (!r.attendance?.checkIn) return false;
        const inTime = new Date(r.attendance.checkIn);
        const istIn = new Date(inTime.getTime() + (5.5 * 60 * 60 * 1000));
        return (istIn.getUTCHours() > 9) || (istIn.getUTCHours() === 9 && istIn.getUTCMinutes() > 40);
      }).length,
      missing: teamData.filter((r: any) => !r.attendance?.checkIn).length,
    };
  };

  const teamStats = getTeamStats(teamAttendance);

  // Set default view mode based on role
  useEffect(() => {
    if (isAdmin) {
      setViewMode('team');
    } else {
      setViewMode('personal');
    }
  }, [isAdmin]);

  const isFetchingRef = React.useRef(false);

  const fetchStatus = async () => {
    if (!workspaceId || isFetchingRef.current) return;
    isFetchingRef.current = true;
    const tFetch = performance.now();
    try {
      const todayString = new Date().toISOString().split('T')[0];

      // Parallel fetch for speed
      const personalPromise = getTodayAttendance(workspaceId, todayString);
      const teamPromise = isAdmin ? getTeamAttendance(workspaceId, todayString) : Promise.resolve([]);

      const [personalData, teamData] = await Promise.all([personalPromise, teamPromise]);
      console.log(`[AttendanceWidget] ⏱ fetchStatus took ${(performance.now() - tFetch).toFixed(1)}ms`);

      setTodayAttendance(personalData);
      setTeamAttendance(teamData);
    } catch (err) {
      console.error("Failed to fetch attendance:", err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    const isPersonalLoaded = todayAttendance !== undefined;
    const isTeamLoaded = !isAdmin || teamAttendance !== undefined;
    const hasData = isPersonalLoaded && isTeamLoaded;

    if (!hasData) {
      setLoading(true);
      fetchStatus();
    }

    // Polling: Auto-refresh team stats for admins every 15 seconds
    const interval = setInterval(() => {
      if (workspaceId) {
        fetchStatus();
      }
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, [workspaceId, isAdmin]);

  const confirmAndCheckOut = () => {
    haptics.warning();
    setCheckOutSheetVisible(true);
  };

  const handleAction = async (type: 'check-in' | 'check-out') => {
    setActionLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationDenied(true);
        setCheckOutSheetVisible(false);
        haptics.error();
        Alert.alert(
          'Location access needed',
          'Trava needs location access to record attendance. Enable it for this app in your device settings, then try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openLocationSettings },
          ]
        );
        setActionLoading(false);
        return;
      }
      setLocationDenied(false);

      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

      const todayString = new Date().toISOString().split('T')[0];
      const latitude = location.coords.latitude;
      const longitude = location.coords.longitude;

      let addressString = "";
      try {
        const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocode && geocode.length > 0) {
          const place = geocode[0];
          addressString = [place.name || place.streetNumber, place.street, place.city || place.subregion, place.region].filter(Boolean).join(", ");
        }
      } catch (err) {
        console.warn("Reverse geocoding failed", err);
      }

      if (type === 'check-in') {
        const result = await submitCheckIn(workspaceId, latitude, longitude, addressString, todayString);
        setTodayAttendance(result);
        haptics.success();
        Alert.alert('Checked In', 'Checked in successfully!');
      } else {
        const result = await submitCheckOut(workspaceId, latitude, longitude, addressString, todayString);
        setTodayAttendance(result);
        setCheckOutSheetVisible(false);
        haptics.success();
        Alert.alert('Checked Out', 'Checked out successfully!');
      }
    } catch (error: any) {
      haptics.error();
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setActionLoading(false);
    }
  };

  const openLocationSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  if (loading) {
    if (variant === "mini") {
      return (
        <View style={[styles.miniBox, { backgroundColor: colors.surface, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const isCheckedIn = !!(attendance && attendance.checkIn);
  const isCheckedOut = !!(attendance && attendance.checkOut);

  const getStatusText = () => {
    if (isAdmin && viewMode === 'team' && teamStats) {
      return `${teamStats.present} Present • ${teamStats.late} Late`;
    }
    if (isCheckedOut) return "Completed Shift";
    if (isCheckedIn) {
      const time = new Date(attendance.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `Working since ${time}`;
    }
    return "Not Checked In";
  };

  if (variant === "mini") {
    let actionType: "check-in" | "check-out" = "check-in";
    const showTeam = isAdmin && viewMode === 'team';

    let iconName = showTeam ? "people-outline" : "time-outline";
    let iconColor = "#eab308";
    let valueText = "Check in";
    let titleText = "Attendance";

    if (showTeam) {
      valueText = teamStats ? `${teamStats.present} / ${teamStats.total}` : "—";
      titleText = "Team Attendance";
    } else {
      if (isCheckedIn && !isCheckedOut) {
        actionType = "check-out";
        valueText = "Check out";
      } else if (isCheckedOut) {
        valueText = "Shift Done";
      }
    }

    return (
      <View
        ref={ref}
        style={[styles.miniBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <TouchableOpacity
          style={{ flex: 1, padding: 14, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', height: '100%' }}
          activeOpacity={0.85}
          delayLongPress={300}
          onLongPress={onLongPress}
          onPress={() => {
            if (showTeam) return;
            if (isCheckedOut) return;
            if (actionType === 'check-out') {
              confirmAndCheckOut();
            } else {
              handleAction(actionType);
            }
          }}
          disabled={actionLoading || (isCheckedOut && !onLongPress)}
          accessibilityRole="button"
          accessibilityLabel={`${titleText}, ${valueText}`}
          accessibilityState={{ disabled: actionLoading || (isCheckedOut && !onLongPress), busy: actionLoading }}
        >
          <View style={[styles.miniIcon, { backgroundColor: "rgba(234, 179, 8, 0.15)" }]}>
            {actionLoading ? (
              <ActivityIndicator color={iconColor} size="small" />
            ) : (
              <Ionicons name={iconName as any} size={20} color={iconColor} />
            )}
          </View>
          <View style={styles.miniTextContent}>
            <Text 
              style={[styles.miniValue, { color: colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              {valueText}
            </Text>
            <Text 
              style={[styles.miniTitle, { color: "#888888" }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {titleText}
            </Text>
          </View>
        </TouchableOpacity>

        {isAdmin && (
          <TouchableOpacity
            style={[styles.toggleBtn, { borderLeftColor: colors.border }]}
            onPress={() => setViewMode(viewMode === 'team' ? 'personal' : 'team')}
            accessibilityRole="button"
            accessibilityLabel={viewMode === 'team' ? "Switch to personal attendance view" : "Switch to team attendance view"}
          >
            <Ionicons
              name={viewMode === 'team' ? "person-outline" : "people-outline"}
              size={16}
              color={colors.textDim}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View ref={ref} style={[styles.container, { backgroundColor: colors.surface + "80", borderColor: colors.border }]}>
      <BlurView intensity={isDark ? 20 : 40} tint={isDark ? "dark" : "light"} style={styles.glassInner}>
        <View style={styles.header}>
          <View style={[styles.iconBox, { backgroundColor: ((isAdmin && viewMode === 'team') || (isCheckedIn && !isCheckedOut)) ? "#10b98120" : "#3b82f620" }]}>
            <Ionicons
              name={(isAdmin && viewMode === 'team') ? "people" : (isCheckedIn && !isCheckedOut ? "timer" : "time")}
              size={20}
              color={((isAdmin && viewMode === 'team') || (isCheckedIn && !isCheckedOut)) ? "#10b981" : "#3b82f6"}
            />
          </View>
          <View style={styles.textContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.title, { color: colors.text }]}>
                {(isAdmin && viewMode === 'team') ? "Team Attendance" : "Today's Attendance"}
              </Text>
              {isAdmin && (
                <TouchableOpacity
                  style={[styles.smallToggle, { backgroundColor: colors.border + "40" }]}
                  onPress={() => setViewMode(viewMode === 'team' ? 'personal' : 'team')}
                >
                  <Text style={{ fontSize: 10, color: colors.text, fontFamily: FONTS.semibold }}>
                    {viewMode === 'team' ? "Switch to Personal" : "Switch to Team"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.statusRow}>
              {((isAdmin && viewMode === 'team') || (isCheckedIn && !isCheckedOut)) && <View style={[styles.dot, { backgroundColor: "#10b981" }]} />}
              <Text style={[styles.subtitle, { color: colors.textDim }]}>{getStatusText()}</Text>
            </View>
          </View>
        </View>

        {(viewMode === 'personal' || !isAdmin) && (
          <View style={styles.actions}>
            {(!isCheckedIn || isCheckedOut) && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={() => handleAction('check-in')}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                {actionLoading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="log-in-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.buttonText}>Check In Now</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {isCheckedIn && !isCheckedOut && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#ef4444' }]}
                onPress={confirmAndCheckOut}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                {actionLoading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="log-out-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.buttonText}>Check Out</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {locationDenied && (
              <View style={[styles.deniedBanner, { backgroundColor: "#ef444412", borderColor: "#ef444440" }]}>
                <Ionicons name="location-outline" size={14} color="#ef4444" />
                <Text style={styles.deniedText}>
                  Location access is off. Enable it in Settings to check in/out.
                </Text>
              </View>
            )}
          </View>
        )}
      </BlurView>

      <ConfirmationSheet
        visible={checkOutSheetVisible}
        title="Check out for the day?"
        description="This will end your shift for today."
        tone="warning"
        confirmLabel="Check Out"
        cancelLabel="Cancel"
        loading={actionLoading}
        onConfirm={() => handleAction('check-out')}
        onClose={() => setCheckOutSheetVisible(false)}
      />
    </View>
  );
});

AttendanceWidget.displayName = "AttendanceWidget";

export default AttendanceWidget;

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
  },
  miniBox: {
    flex: 1,
    width: '100%',
    height: 115,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "stretch",
  },
  miniIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  miniTextContent: {
    marginTop: "auto",
    width: "100%",
  },
  miniValue: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    marginBottom: 2,
  },
  miniTitle: {
    fontSize: 12,
    fontFamily: FONTS.medium,
  },

  glassInner: {
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: FONTS.medium,
  },
  actions: {
    marginTop: SPACING.xs,
  },
  button: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
  },
  smallToggle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deniedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  deniedText: {
    flex: 1,
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: '#ef4444',
  },
});
