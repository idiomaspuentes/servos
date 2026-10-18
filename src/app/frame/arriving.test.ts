import { describe, expect, it } from 'vitest'
import { arrive, fileToReceive, isShared, onArrived, type Arrived } from './arriving'

describe('work that comes from outside the app', () => {
  it('knows shared work by its name, as Servos and the page inside Claude save it', () => {
    expect(isShared('Jonás 1-4.servos')).toBe(true)
    expect(isShared('JONÁS.SERVOS')).toBe(true)
    expect(isShared('Jonás.servos.json')).toBe(true)
    expect(isShared('JON.usfm')).toBe(false)
    expect(isShared('servos-interfaz-pt.json')).toBe(false)
  })

  it('receives the shared file among several dropped together, or else the first', () => {
    expect(fileToReceive([{ name: 'nota.txt' }, { name: 'Tito.servos' }])?.name).toBe('Tito.servos')
    expect(fileToReceive([{ name: 'JON.usfm' }, { name: 'foto.jpg' }])?.name).toBe('JON.usfm')
    expect(fileToReceive([])).toBeUndefined()
  })

  it('keeps what arrives before the app listens, the newest only, and gives it once', () => {
    arrive({ name: 'viejo.servos', text: '1' })
    arrive({ name: 'nuevo.servos', text: '2' })
    const taken: Arrived[] = []
    const stop = onArrived((file) => taken.push(file))
    expect(taken.map((f) => f.name)).toEqual(['nuevo.servos'])
    arrive({ name: 'otro.servos', text: '3' })
    expect(taken.map((f) => f.name)).toEqual(['nuevo.servos', 'otro.servos'])
    stop()
    const again: Arrived[] = []
    onArrived((file) => again.push(file))()
    expect(again).toEqual([])
  })
})
