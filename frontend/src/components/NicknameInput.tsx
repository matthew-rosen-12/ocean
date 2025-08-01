import React, { useState, useEffect, useRef } from "react";
import { generateUserNickname } from "shared/nickname-generator";

// Cookie utility functions
const setCookie = (name: string, value: string, days: number = 365) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

const getCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i];
    while (cookie.charAt(0) === " ") cookie = cookie.substring(1, cookie.length);
    if (cookie.indexOf(nameEQ) === 0) return cookie.substring(nameEQ.length, cookie.length);
  }
  return null;
};

interface NicknameInputProps {
  onSubmit: (nickname: string) => void;
  loading?: boolean;
  className?: string;
  id?: string;
  onNicknameChange?: (nickname: string) => void;
}

export default function NicknameInput({ onSubmit, loading = false, className = "", id = "nickname", onNicknameChange }: NicknameInputProps) {
  const [nickname, setNickname] = useState("");
  const [suggestedNickname, setSuggestedNickname] = useState("");
  const [userHasTyped, setUserHasTyped] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load saved nickname and generate random suggestion
  useEffect(() => {
    const suggestion = generateUserNickname();
    setSuggestedNickname(suggestion);

    // Try to load saved nickname from cookie
    const savedNickname = getCookie("lastNickname");
    if (savedNickname && savedNickname.trim()) {
      setNickname(savedNickname);
      setUserHasTyped(true); // User has previously typed this nickname
    } else {
      setNickname(""); // Start with empty value for placeholder approach
      setUserHasTyped(false); // Ensure we're in suggestion mode  
    }
    setInitialized(true);
  }, []);

  // Set cursor to beginning whenever we're in suggestion mode
  useEffect(() => {
    if (!userHasTyped && inputRef.current && nickname === "") {
      inputRef.current.setSelectionRange(0, 0);
    }
  }, [userHasTyped, nickname, suggestedNickname]);

  // Notify parent of current nickname whenever it changes
  useEffect(() => {
    if (onNicknameChange && initialized) {
      const currentNickname = getFinalNickname();
      onNicknameChange(currentNickname);
    }
  }, [nickname, suggestedNickname, userHasTyped, initialized, onNicknameChange]);

  const handleNicknameFocus = () => {
    if (!userHasTyped && inputRef.current) {
      // Ensure cursor is at beginning when focusing on suggestion
      inputRef.current.setSelectionRange(0, 0);
    }
  };

  const handleNicknameClick = () => {
    if (!userHasTyped && inputRef.current) {
      // Ensure cursor is at beginning when clicking on suggestion
      inputRef.current.setSelectionRange(0, 0);
    }
  };

  const handleNicknameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Enter key to submit
    if (e.key === "Enter") {
      handleSubmit();
      return;
    }

    // Handle Tab key to accept suggestion and move cursor to end
    if (!userHasTyped && e.key === "Tab") {
      e.preventDefault(); // Prevent default tab behavior
      setUserHasTyped(true); // Mark as user-typed to change appearance
      setNickname(suggestedNickname); // Set the nickname to the suggestion
      
      // Use a slightly longer timeout to ensure React has time to update the DOM
      setTimeout(() => {
        if (inputRef.current) {
          const length = suggestedNickname.length;
          inputRef.current.setSelectionRange(length, length);
          inputRef.current.focus();
        }
      }, 10); // 10ms should be enough for React to update
      return;
    }

    // Prevent backspace/delete from clearing suggestion when we're already in suggestion mode
    if (!userHasTyped && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault(); // Prevent the backspace from doing anything
      return;
    }

    if (
      !userHasTyped &&
      e.key !== "Tab" &&
      e.key !== "Shift" &&
      e.key !== "Control" &&
      e.key !== "Alt" &&
      e.key !== "Meta"
    ) {
      // User is starting to type a character - clear suggestion, character will be added by onChange
      setNickname("");
      setUserHasTyped(true);
    }
  };

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (!userHasTyped) {
      // First time typing - switch to user input mode
      setUserHasTyped(true);
      setNickname(value);
    } else {
      setNickname(value);
      // If user clears everything, go back to suggestion mode
      if (value === "") {
        setUserHasTyped(false);
      }
    }
  };

  const getFinalNickname = () => {
    if (userHasTyped) {
      const trimmedNickname = nickname.trim();
      return trimmedNickname || suggestedNickname;
    }
    return suggestedNickname;
  };

  const handleSubmit = () => {
    const finalNickname = getFinalNickname();
    // Save the nickname to cookie for future use
    setCookie("lastNickname", finalNickname);
    onSubmit(finalNickname);
  };

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      value={userHasTyped ? nickname : ""}
      placeholder={!userHasTyped ? suggestedNickname : ""}
      onChange={handleNicknameChange}
      onKeyDown={handleNicknameKeyDown}
      onFocus={handleNicknameFocus}
      onClick={handleNicknameClick}
      className={`w-full px-4 py-4 bg-white/40 border border-white/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:border-blue-400/60 backdrop-blur-sm transition-all duration-200 placeholder-gray-600 text-lg caret-gray-800 ${
        !initialized || !userHasTyped ? "text-gray-300" : "text-gray-900"
      } hover:bg-white/50 focus:bg-white/60 selection:bg-blue-200/50 ${className}`}
      maxLength={20}
      disabled={loading}
    />
  );
}