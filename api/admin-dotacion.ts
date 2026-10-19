import { createDotacionHandler } from '../server/dotacion/handler.ts'

export const config = { maxDuration: 60 }
export default createDotacionHandler()
