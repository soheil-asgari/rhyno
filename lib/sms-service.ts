// lib/sms-service.ts
const SMS_API_KEY = process.env.SMS_API_KEY

export async function sendSMS(
  phone: string,
  template: string,
  tokens: string[]
) {
  console.log(
    `📩 SMS Simulation -> To: ${phone} | Template: ${template} | Tokens: ${tokens.join(", ")}`
  )

  // در محیط واقعی، اینجا درخواست به API پنل پیامکی را می‌زنید
  // مثال:
  // await fetch("https://api.sms-provider.com/send", { ... })

  return { success: true }
}

// توابع کمکی برای سناریوهای خاص
export async function sendAssignmentSMS(phone: string, supplier: string) {
  return sendSMS(phone, "new_task_template", [supplier])
}

export async function sendCompletionSMS(phone: string, supplier: string) {
  return sendSMS(phone, "task_completed_template", [supplier])
}

export async function sendReminderSMS(phone: string, supplier: string) {
  return sendSMS(phone, "reminder_template", [supplier])
}
