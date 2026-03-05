"use client";

interface TextAnswerProps {
  text: string;
}

export default function TextAnswer({ text }: TextAnswerProps) {
  // Simple markdown: bold (**text**) and line breaks
  const rendered = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");

  return (
    <div
      className="text-[15px] leading-relaxed text-[#0A2540]"
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}
