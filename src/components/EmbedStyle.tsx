/**
 * `?embed=1`: the page is shown inside a phone frame (home page hero,
 * dashboard preview), where a desktop scrollbar breaks the illusion. The
 * page still scrolls by wheel, touch and keyboard.
 */
export function EmbedStyle({ embed }: { embed: string }) {
  if (embed !== "1") return null;
  return <style>{"html{scrollbar-width:none}html::-webkit-scrollbar{display:none}"}</style>;
}
