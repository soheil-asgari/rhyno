if (payload.chatSettings.model.includes("-tts")) {
    // ✅✅✅ شروع کد جدید

    // (این کد تقریباً مشابه handleRegenerateTTS است)
    console.log(`[Handler] Executing NON-STREAMING path for ${payload.chatSettings.model}`);

    const response = await fetch("/api/chat/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload) // 'payload' حالا chat_id را دارد
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${errorText}`);
    }

    const data = await response.json();

    generatedText = data.text || "پاسخ صوتی";
    assistantFileUrl = data.audioUrl || null; // ❗️ متغیر URL صدا را ست کنید

    // آپدیت پیام دستیار با محتوای نهایی
    tempAssistantChatMessage.message.content = generatedText;
    if (assistantFileUrl) {
        tempAssistantChatMessage.message.audio_url = assistantFileUrl;
    }

    setChatMessages(prev => [...prev, tempAssistantChatMessage]);

    // ✅✅✅ پایان کد جدید
    // منطق TTS شما...
} else if (payload.chatSettings.model === "dall-e-3") {

    // --- ✅✅✅ مسیر DALL-E (JSON) --- ✅✅✅
    console.log(`[Handler] Executing NON-STREAMING path for DALL-E 3`);
    setToolInUse("image_generation");

    const response = await fetch("/api/chat/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${errorText}`);
    }

    const data = await response.json();

    generatedText = data.text || "تصویر ساخته شد"; // (بک‌اند متن را هم برمی‌گرداند)
    assistantFileUrl = data.imageUrl || null; // (بک‌اند imageUrl را برمی‌گرداند)

    // آپدیت پیام دستیار با محتوای نهایی
    if (assistantFileUrl) {
        generatedText = `${generatedText}\n\n![Generated Image](${assistantFileUrl})`;
        tempAssistantChatMessage.message.image_paths = [assistantFileUrl];
    }
    tempAssistantChatMessage.message.content = generatedText;

    setChatMessages(prev => [...prev, tempAssistantChatMessage]);