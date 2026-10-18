// The editor on a phone with the keyboard up: one thing in sight, the box or the text it is translated from; a finger
// slides between them, or a tab is touched, and the box keeps the focus (a real phone keeps its keyboard up), with
// nothing lost of what was written and the page never scrolled. Run it after any change to the editor or the styles:
//
//   playwright-cli -s=servos open --device="Pixel 7" http://localhost:5190/
//   playwright-cli -s=servos resize 375 812
//   (open «Ver el ejemplo como Ana» › Jonás › Traducir por escrito › Empezar)
//   playwright-cli -s=servos --raw run-code --filename=scripts/editor-swipe.js
//
// Every step must say the pane it went to, the box still focused, and the text as typed.
async (page) => {
  const cdp = await page.context().newCDPSession(page)
  const touch = async (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
  const swipe = async (from, to, y) => {
    await touch('touchStart', from, y)
    for (let i = 1; i <= 8; i++) {
      await touch('touchMove', from + ((to - from) * i) / 8, y)
      await page.waitForTimeout(16)
    }
    await touch('touchEnd', to, y)
    await page.waitForTimeout(450)
  }
  const state = () =>
    page.evaluate(() => ({
      pane: document.querySelector('.panes-tab[aria-selected="true"]')?.textContent,
      focused: document.activeElement?.tagName === 'TEXTAREA',
      value: document.querySelector('textarea')?.value ?? null,
      pageScrolled: window.scrollY !== 0,
    }))
  const log = []
  const first = await page.locator('.panes-tab').first().textContent()
  await page.locator('.panes-tab').first().click()
  await page.waitForTimeout(400)
  await page.locator('textarea').first().click()
  await page.keyboard.press('End')
  await page.keyboard.type(' prueba')
  log.push(['escrito', await state()])
  // The keyboard takes the bottom half: the window shrinks as on a phone.
  await page.setViewportSize({ width: 375, height: 420 })
  await page.waitForTimeout(300)
  await swipe(320, 40, 250)
  log.push(['deslizar a la izquierda', await state()])
  await swipe(40, 320, 250)
  log.push(['deslizar a la derecha', await state()])
  const third = page.locator('.panes-tab').nth(2)
  await third.click()
  await page.waitForTimeout(400)
  log.push(['tocar la tercera pestaña', await state()])
  await page.locator('.panes-tab', { hasText: first }).click()
  await page.waitForTimeout(400)
  await page.keyboard.type(' sigue')
  log.push(['volver y seguir escribiendo', await state()])
  await page.setViewportSize({ width: 375, height: 812 })
  const failed = log.filter(([, s]) => !s.focused || s.pageScrolled)
  return JSON.stringify({ ok: failed.length === 0, log }, null, 1)
}
