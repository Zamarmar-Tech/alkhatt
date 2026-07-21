/**
 * @fileoverview Font asset registry.
 *
 * Maps font family names to their Vite-processed asset URLs.
 * Each font file is statically imported so Vite includes it in the build
 * output and provides the correct hashed URL.
 *
 * To add a new font:
 *   1. Place the .ttf file in `src/assets/fonts/<FontName>/`
 *   2. Import it below
 *   3. Add an entry to the `fontRegistry` object
 */
import amiriRegular from '@/assets/fonts/Amiri/Amiri-Regular.ttf'
import arefRegular from '@/assets/fonts/Aref_Ruqaa/ArefRuqaa-Regular.ttf'
import katibehRegular from '@/assets/fonts/Katibeh/Katibeh-Regular.ttf'
import notoNaskhArabic from '@/assets/fonts/Noto_Naskh_Arabic/NotoNaskhArabic-VariableFont_wght.ttf'
import reemKufi from '@/assets/fonts/Reem_Kufi/ReemKufi-VariableFont_wght.ttf'

/**
 * Map of font family keys to their static asset URLs.
 * The key is the folder name used in `canvasStore.selectedFont`.
 */
export const fontRegistry: Record<string, string> = {
  Amiri: amiriRegular,
  Aref_Ruqaa: arefRegular,
  Katibeh: katibehRegular,
  Noto_Naskh_Arabic: notoNaskhArabic,
  Reem_Kufi: reemKufi,
}
