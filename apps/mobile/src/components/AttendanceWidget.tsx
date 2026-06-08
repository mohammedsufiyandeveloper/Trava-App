import React, { useState, useEffect, forwardRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS } from '../constants/theme';
import { getTodayAttendance, submitCheckIn, submitCheckOut, getWorkspaces, getTeamAttendance, getCachedSession } from '../services/api';

import { useWorkspace } from '../context/WorkspaceContext';

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
    Alert.alert(
      'Check Out for the Day?',
      'Are you sure you want to check out? This will end your shift for today.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Check Out',
          style: 'destructive',
          onPress: () => handleAction('check-out'),
        },
      ],
      { cancelable: true }
    );
  };

  const handleAction = async (type: 'check-in' | 'check-out') => {
    setActionLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied');
        setActionLoading(false);
        return;
      }

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
        Alert.alert('Success', 'Checked in successfully!');
      } else {
        const result = await submitCheckOut(workspaceId, latitude, longitude, addressString, todayString);
        setTodayAttendance(result);
        Alert.alert('Success', 'Checked out successfully!');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    if (variant === "mini") {
      return (
        <View style={[styles.miniBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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

  const isCheckedIn = attendance && attendance.checkIn;
  const isCheckedOut = attendance && attendance.checkOut;

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

    let iconName = showTeam ? "people" : "log-in";
    let iconColor = showTeam ? colors.primary : "#3b82f6";
    let titleText = showTeam ? "Team Roster" : "Check In";
    let valueText = showTeam ? (teamStats ? `${teamStats.present} / ${teamStats.total}` : "—") : "Time";

    if (!showTeam) {
      if (isCheckedIn && !isCheckedOut) {
        actionType = "check-out";
        iconName = "log-out";
        iconColor = "#ef4444";
        titleText = "Check Out";
        valueText = "Active";
      } else if (isCheckedOut) {
        iconName = "checkmark-circle";
        iconColor = "#10b981";
        titleText = "Shift Done";
        valueText = "Done";
      }
    }

    return (
      <TouchableOpacity
        ref={ref}
        style={[styles.miniBox, { backgroundColor: colors.surface, borderColor: colors.border, paddingRight: 0 }]}
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
        disabled={actionLoading || isCheckedOut && !onLongPress}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.miniIcon, { backgroundColor: iconColor + "20" }]}>
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
              style={[styles.miniTitle, { color: colors.textDim }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {titleText}
            </Text>
          </View>
        </View>

        {isAdmin && (
          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => setViewMode(viewMode === 'team' ? 'personal' : 'team')}
          >
            <Ionicons
              name={viewMode === 'team' ? "person-outline" : "people-outline"}
              size={16}
              color={colors.textDim}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
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
                  <Text style={{ fontSize: 10, color: colors.text, fontWeight: '600' }}>
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
          </View>
        )}
      </BlurView>
    </View>
  );
});

export default AttendanceWidget;

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
  },
  // Mini variant styles (matching statBox from HomeScreen)
  miniBox: {
    flex: 1,
    width: '100%',
    height: 80,
    paddingHorizontal: 14,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  miniIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  miniTextContent: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 8,
  },
  miniValue: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  miniTitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
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
    fontWeight: '700',
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
    fontWeight: '500',
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
    fontWeight: '700',
  },
  toggleBtn: {
    paddingHorizontal: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(0,0,0,0.05)',
  },
  smallToggle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  }
});
