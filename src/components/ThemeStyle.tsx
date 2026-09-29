import { STYLE_FONT_HREF, computeTheme, themeCss } from "@/lib/theme";
import type { VenueBranding } from "@/lib/venue/types";

/**
 * Server-rendered venue theme: the colour tokens as a :root rule and, for a
 * style preset only, its web font. The page never paints in default colours.
 */
export function ThemeStyle({ branding }: { branding: VenueBranding }) {
  const theme = computeTheme(branding);
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
      {theme.style && <link rel="stylesheet" href={STYLE_FONT_HREF[theme.style]} precedence="default" />}
    </>
  );
}
