import { defineBoot } from '#q-app/wrappers'
import { Lang } from 'quasar'
import { installLocalization, initializeLocale } from '../i18n/index.js'
export default defineBoot(async ({app})=>{await initializeLocale();installLocalization(app,Lang)})
