// rhyno/components/chat/RealtimeStartButton.jsx
"use client";
import React, { useContext } from "react";
import { ChatbotUIContext } from "@/context/context";

export const RealtimeStartButton = () => {
    // این توابع از context پروژه rhyno می‌آیند
    const { startRecording, stopRecording, isRecording, loading } =
        useContext(ChatbotUIContext);

    const handleClick = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    return (
        <div
            style={{
                position: "fixed",
                bottom: "40px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 100,
            }}
        >
            <button
                onClick={handleClick}
                disabled={loading}
                className={`rounded-full px-6 py-4 font-bold text-white ${isRecording
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-green-500 hover:bg-green-600"
                    } ${loading ? "cursor-not-allowed opacity-50" : ""}`}
            >
                {isRecording ? "Stop" : "Start"}
            </button>
        </div>
    );
};