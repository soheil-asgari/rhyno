import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { FC, useEffect } from "react";
import { SIDEBAR_ICON_SIZE } from "../sidebar/sidebar-switcher";
import { Button } from "../ui/button";

interface ThemeSwitcherProps { }

export const ThemeSwitcher: FC<ThemeSwitcherProps> = () => {
  const { setTheme, theme } = useTheme();

  // بارگذاری تم از localStorage هنگام بارگذاری صفحه
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setTheme(savedTheme as "light" | "dark");
    }
  }, [setTheme]);

  const handleChange = (theme: "dark" | "light") => {
    // ذخیره تم در localStorage و تغییر آن
    localStorage.setItem("theme", theme);
    setTheme(theme);
  };

  return (
    <Button
      className="flex cursor-pointer space-x-2"
      variant="ghost"
      size="icon"
      onClick={() => handleChange(theme === "light" ? "dark" : "light")}
    >
      {theme === "dark" ? (
        <IconMoon size={SIDEBAR_ICON_SIZE} />
      ) : (
        <IconSun size={SIDEBAR_ICON_SIZE} />
      )}
    </Button>
  );
};
