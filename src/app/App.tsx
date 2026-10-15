/** The prototype: the catalog, the mini apps in their frame, receiving a pack, and the interface translator. */

import { useState } from 'react'
import { TITO_1 } from '../prototype/data'
import { MiniAppScreen } from './frame/MiniAppScreen'
import type { MiniApp, Position, ResourceNeed } from './miniapps/contract'
import { miniApp } from './miniapps/registry'
import { Catalog } from './screens/Catalog'
import { Language } from './screens/Language'
import { PEOPLE, PersonMenu } from './screens/PersonMenu'
import { ReceivePack } from './screens/ReceivePack'
import { TranslateUi } from './screens/TranslateUi'

type Screen = { kind: 'catalog' } | { kind: 'app'; id: string } | { kind: 'receive' } | { kind: 'translate' }

/** In the prototype the phone has every resource of the fixed chapter. */
const AVAILABLE: ResourceNeed[] = ['text', 'notes', 'questions', 'words', 'academy']

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'catalog' })
  const [person, setPerson] = useState(PEOPLE[0])
  const [personMenu, setPersonMenu] = useState(false)
  const [language, setLanguage] = useState(false)
  const [position, setPosition] = useState<Position>({ book: TITO_1.book.id, chapter: TITO_1.chapter, verse: 1 })
  const [text, setText] = useState('TPL')

  const app: MiniApp | undefined = screen.kind === 'app' ? miniApp(screen.id) : undefined
  const openPersonMenu = () => setPersonMenu(true)

  return (
    <>
      {screen.kind === 'catalog' && (
        <Catalog data={TITO_1} person={person} available={AVAILABLE} onOpen={(a) => setScreen({ kind: 'app', id: a.id })} onPersonMenu={openPersonMenu} />
      )}
      {app && (
        <MiniAppScreen
          app={app}
          data={TITO_1}
          person={person}
          position={position}
          onPosition={setPosition}
          textAbbreviation={text}
          onTextAbbreviation={setText}
          onBack={() => setScreen({ kind: 'catalog' })}
        />
      )}
      {screen.kind === 'receive' && (
        <ReceivePack onBack={() => setScreen({ kind: 'catalog' })} onStudy={() => setScreen({ kind: 'app', id: 'estudio' })} />
      )}
      {screen.kind === 'translate' && <TranslateUi onBack={() => setScreen({ kind: 'catalog' })} />}

      {personMenu && (
        <PersonMenu
          person={person}
          onClose={() => setPersonMenu(false)}
          onPerson={(name) => {
            setPerson(name)
            setPersonMenu(false)
          }}
          onReceive={() => {
            setPersonMenu(false)
            setScreen({ kind: 'receive' })
          }}
          onLanguage={() => {
            setPersonMenu(false)
            setLanguage(true)
          }}
          onTranslate={() => {
            setPersonMenu(false)
            setScreen({ kind: 'translate' })
          }}
        />
      )}
      {language && <Language onClose={() => setLanguage(false)} />}
    </>
  )
}
