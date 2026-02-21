import en from "../locales/en.json"
import fr from "../locales/fr.json"
import es from "../locales/es.json"
import de from "../locales/de.json"
import it from "../locales/it.json"
import ptBR from "../locales/pt-BR.json"
import nl from "../locales/nl.json"
import sv from "../locales/sv.json"
import nb from "../locales/nb.json"
import da from "../locales/da.json"
import ru from "../locales/ru.json"
import pl from "../locales/pl.json"
import uk from "../locales/uk.json"
import zhCN from "../locales/zh-CN.json"
import zhTW from "../locales/zh-TW.json"
import ja from "../locales/ja.json"
import ko from "../locales/ko.json"
import tr from "../locales/tr.json"
import cs from "../locales/cs.json"
import ro from "../locales/ro.json"
import hu from "../locales/hu.json"
import el from "../locales/el.json"
import id from "../locales/id.json"
import vi from "../locales/vi.json"
import hi from "../locales/hi.json"
import mr from "../locales/mr.json"
import bn from "../locales/bn.json"
import ta from "../locales/ta.json"
import te from "../locales/te.json"
import ar from "../locales/ar.json"
import he from "../locales/he.json"
import fa from "../locales/fa.json"
import ur from "../locales/ur.json"
import ps from "../locales/ps.json"
import sd from "../locales/sd.json"
import ug from "../locales/ug.json"
import ckb from "../locales/ckb.json"
import yi from "../locales/yi.json"

type NestedKeyOf<T extends object, K extends keyof T = keyof T> = K extends string
  ? T[K] extends object ? `${K}.${NestedKeyOf<T[K]>}` : K
  : never

export type TranslationKey = NestedKeyOf<typeof en>

const locales = {
  en,
  fr, es, de, it,
  "pt-BR": ptBR,
  nl, sv, nb, da,
  ru, pl, uk,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  ja, ko,
  tr, cs, ro, hu,
  el, id, vi,
  hi, mr, bn, ta, te,
  ar, he, fa, ur,
  ps, sd, ug, ckb, yi,
} as const

type LocaleId = keyof typeof locales

function getLocale(): LocaleId {
  const s = localStorage.getItem("eclipse-locale")
  return s && s in locales ? (s as LocaleId) : "en"
}

export const RTL_LOCALES = new Set(["ar", "he", "fa", "ur", "ps", "sd", "ug", "ckb", "yi"])
export const isRTL = () => RTL_LOCALES.has(getLocale())

export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  const parts = key.split(".")
  let node: unknown = locales[getLocale()]
  for (const p of parts) node = (node as Record<string, unknown>)?.[p]
  if (typeof node !== "string") {
    node = en
    for (const p of parts) node = (node as Record<string, unknown>)?.[p]
  }
  let result = typeof node === "string" ? node : key
  if (vars) for (const [k, v] of Object.entries(vars)) result = result.split(`{{${k}}}`).join(String(v))
  return result
}
