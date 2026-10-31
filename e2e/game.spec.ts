import { test, expect, type Page } from '@playwright/test'

async function ready(page: Page) {
  await page.goto('/')
  await expect(
    page.getByText('FINDING YOUR ORBIT', { exact: false }),
  ).toBeHidden()
}
async function playerPosition(page: Page) {
  return page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')!,
      { data, width, height } = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      )
    let x = 0,
      y = 0,
      count = 0
    for (let iy = 0; iy < height; iy++)
      for (let ix = 0; ix < width; ix++) {
        const p = (iy * width + ix) * 4
        if (
          data[p] > 180 &&
          data[p + 1] > 200 &&
          data[p + 2] > 225 &&
          data[p + 3] > 220
        ) {
          x += ix
          y += iy
          count++
        }
      }
    return {
      x: x / count / (canvas.width / canvas.clientWidth),
      y: y / count / (canvas.height / canvas.clientHeight),
      count,
    }
  })
}

test('desktop menu, keyboard movement, pause, resume and settings', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await ready(page)
  await expect(page.getByRole('heading', { name: 'NEON ORBIT.' })).toBeVisible()
  await page.screenshot({ path: '/tmp/neon-orbit-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Let’s play' }).click()
  await expect(page.getByText('YOU’RE IN THE ORBIT')).toBeVisible()
  const before = await playerPosition(page)
  expect(before.count).toBeGreaterThan(0)
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(300)
  await page.keyboard.up('ArrowRight')
  const after = await playerPosition(page)
  expect(after.x).toBeGreaterThan(before.x + 30)
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('heading', { name: 'Take your time.' }),
  ).toBeVisible()
  const time = await page.locator('.game-hud').innerText()
  await page.waitForTimeout(1100)
  expect(await page.locator('.game-hud').innerText()).toBe(time)
  await page.screenshot({ path: '/tmp/neon-orbit-paused.png' })
  await page.getByRole('button', { name: 'Back to the orbit' }).click()
  await expect(
    page.getByRole('heading', { name: 'Take your time.' }),
  ).toBeHidden()
  await page.getByRole('button', { name: 'Open settings' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('switch', { name: 'Sound', exact: true }).click()
  await expect(
    page.getByRole('switch', { name: 'Sound', exact: true }),
  ).toHaveAttribute('aria-checked', 'false')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Back to home' }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/neon-orbit-light.png', fullPage: true })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.getByRole('button', { name: 'Enable sound' })).toBeVisible()
  expect(errors).toEqual([])
})

test('mobile layout, touch movement, instructions and reduced motion', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await ready(page)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')
  await page.screenshot({ path: '/tmp/neon-orbit-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'HOW TO PLAY' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Got it. Find my flow.' }).click()
  await page.getByRole('button', { name: 'Let’s play' }).click()
  const before = await playerPosition(page)
  const box = (await page.locator('canvas').boundingBox())!
  const session = await context.newCDPSession(page)
  const point = { x: box.x + box.width * 0.8, y: box.y + box.height * 0.65 }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [point],
  })
  await page.waitForTimeout(450)
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  const after = await playerPosition(page)
  expect(after.x).toBeGreaterThan(before.x + 20)
  expect(after.y).toBeGreaterThan(before.y + 20)
  await page.getByRole('button', { name: 'Pause game' }).click()
  await expect(
    page.getByRole('heading', { name: 'Take your time.' }),
  ).toBeVisible()
  await page.waitForTimeout(350)
  await page.screenshot({ path: '/tmp/neon-orbit-mobile-game.png' })
  await context.close()
})

test('natural obstacle collision, game over, best score and restart', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let seed = 42
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
  })
  await ready(page)
  await page.getByRole('button', { name: 'Let’s play' }).click()
  await expect(
    page.getByRole('heading', { name: 'A good little run.' }),
  ).toBeVisible({ timeout: 35000 })
  const result = page.locator('.result-stats strong')
  const score = Number((await result.first().innerText()).replaceAll(',', ''))
  expect(score).toBeGreaterThan(0)
  expect(await result.last().innerText()).toBe(await result.first().innerText())
  await page.screenshot({ path: '/tmp/neon-orbit-game-over.png' })
  await page.getByRole('button', { name: 'One more orbit' }).click()
  await expect(page.getByText('YOU’RE IN THE ORBIT')).toBeVisible()
  await page.getByRole('button', { name: 'Pause game' }).click()
  await page.getByRole('button', { name: 'Back to home' }).click()
  await page.reload()
  const stored = await page.evaluate(() =>
    Number(localStorage.getItem('neon-orbit.best')),
  )
  expect(stored).toBe(score)
})

test('collecting an actual canvas spark updates the live score', async ({
  page,
}) => {
  await ready(page)
  await page.getByRole('button', { name: 'Let’s play' }).click()
  const target = await page
    .locator('canvas')
    .evaluate((canvas: HTMLCanvasElement) => {
      const { data, width, height } = canvas
        .getContext('2d')!
        .getImageData(0, 0, canvas.width, canvas.height)
      let nearest = { x: 0, y: 0, distance: Infinity }
      for (let y = 0; y < height; y += 2)
        for (let x = 0; x < width; x += 2) {
          const i = (y * width + x) * 4
          if (
            data[i] > 160 &&
            data[i + 1] > 210 &&
            data[i + 2] < 195 &&
            data[i + 3] > 230
          ) {
            const distance = Math.hypot(x - width / 2, y - height / 2)
            if (distance < nearest.distance) nearest = { x, y, distance }
          }
        }
      const rect = canvas.getBoundingClientRect()
      return {
        x: rect.x + (nearest.x * rect.width) / width,
        y: rect.y + (nearest.y * rect.height) / height,
        found: Number.isFinite(nearest.distance),
      }
    })
  expect(target.found).toBe(true)
  await page.mouse.move(target.x, target.y)
  await page.mouse.down()
  await expect
    .poll(
      async () =>
        Number(
          await page
            .locator('.game-hud .hud-secondary')
            .first()
            .locator('strong')
            .innerText(),
        ),
      { timeout: 4000 },
    )
    .toBeGreaterThan(0)
  await page.mouse.up()
  await page.keyboard.press('p')
  const score = Number(
    (await page.locator('.result-stats strong').first().innerText()).replaceAll(
      ',',
      '',
    ),
  )
  expect(score).toBeGreaterThanOrEqual(100)
})
