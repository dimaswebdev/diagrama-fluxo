const TEXT_MIN_WIDTH = 120;
const TEXT_MIN_HEIGHT = 48;

export const estimateTextHeight = (
  text: string,
  width: number,
  fontSize: number,
  lineHeight = 1.15
) => {
  const safeWidth = Math.max(TEXT_MIN_WIDTH, width);
  const charsPerLine = Math.max(10, Math.floor((safeWidth - 24) / (fontSize * 0.58)));
  const paragraphs = (text || '').split('\n');
  let lineCount = 0;

  for (const paragraph of paragraphs) {
    const safeParagraph = paragraph.trim().length > 0 ? paragraph : ' ';
    lineCount += Math.max(1, Math.ceil(safeParagraph.length / charsPerLine));
  }

  return Math.max(TEXT_MIN_HEIGHT, Math.ceil(lineCount * fontSize * lineHeight + 24));
};
