import { createIntakeHandler } from '../server/intake/handler.ts'
export const config = { maxDuration: 60 }
export default createIntakeHandler()
