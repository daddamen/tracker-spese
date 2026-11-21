import { createContext, useContext } from 'react'
export const DatiPersone = createContext({ persone: [], gruppi: [] })
export const usePersone = () => useContext(DatiPersone)
