import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DARK_COLORS, LIGHT_COLORS, ThemeColors } from "../constants/theme";

type Theme = "light" | "dark";

interface ThemeContextType {
    theme: Theme;
    colors: ThemeColors;
    isDark: boolean;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "@tusker_theme_preference";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [theme, setThemeState] = useState<Theme>("dark");

    // Load persisted theme or use system default
    useEffect(() => {
        const loadTheme = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
                if (savedTheme === "light" || savedTheme === "dark") {
                    setThemeState(savedTheme as Theme);
                } else if (systemColorScheme) {
                    setThemeState(systemColorScheme);
                }
            } catch (error) {
                console.error("Error loading theme preference:", error);
            }
        };
        loadTheme();
    }, [systemColorScheme]);

    const setTheme = async (newTheme: Theme) => {
        setThemeState(newTheme);
        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
        } catch (error) {
            console.error("Error saving theme preference:", error);
        }
    };

    const toggleTheme = () => {
        const newTheme = theme === "dark" ? "light" : "dark";
        setTheme(newTheme);
    };

    const colors = theme === "dark" ? DARK_COLORS : LIGHT_COLORS;
    const isDark = theme === "dark";

    return (
        <ThemeContext.Provider value={{ theme, colors, isDark, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};
