import { expect, test, type Page } from '@playwright/test'
import { getE2ECredentials, loginViaUI } from './helpers/auth'

const credentials = getE2ECredentials()

async function ensureTransactionFormReady(page: Page) {
  await page.goto('/transactions/new')

  const noAccountsState = page.getByTestId('new-transaction-no-accounts')
  const needsBootstrap = (await noAccountsState.count()) > 0

  if (!needsBootstrap) {
    await expect(page.getByTestId('transaction-form')).toBeVisible()
    return
  }

  const accountName = `E2E Seed ${Date.now()}`
  await page.goto('/portfolio')
  await expect(page.getByTestId('portfolio-form')).toBeVisible()

  await page.getByTestId('portfolio-name-input').fill(accountName)
  await page.getByTestId('portfolio-initial-balance-input').fill('100')
  await page.getByTestId('portfolio-submit-button').click()
  await expect(page.getByTestId('portfolio-name-input')).toHaveValue('', { timeout: 15_000 })

  await page.goto('/transactions/new')
  await expect(page.getByTestId('transaction-form')).toBeVisible()
}

async function createPortfolioAccount(page: Page, accountName: string) {
  await page.goto('/portfolio')
  await expect(page.getByTestId('portfolio-form')).toBeVisible()

  await page.getByTestId('portfolio-name-input').fill(accountName)
  await page.getByTestId('portfolio-institution-input').fill('E2E Bank')
  await page.getByTestId('portfolio-initial-balance-input').fill('250')
  await page.getByTestId('portfolio-submit-button').click()

  await expect(page.getByTestId('portfolio-name-input')).toHaveValue('', { timeout: 15_000 })
}

async function createCategory(page: Page, categoryName: string) {
  await page.goto('/admin')
  await expect(page.getByTestId('categories-form')).toBeVisible()

  await page.getByTestId('categories-name-input').fill(categoryName)
  await page.getByTestId('categories-scope-select').selectOption('EXPENSE')
  await page.getByTestId('categories-submit-button').click()

  await expect(page.getByTestId('categories-name-input')).toHaveValue('', { timeout: 15_000 })
}

async function createBankEntity(page: Page, bankName: string) {
  await page.goto('/admin?tab=banks')
  await expect(page.getByTestId('bank-entities-create-button')).toBeVisible()

  await page.getByTestId('bank-entities-create-button').click()

  await page.getByTestId('bank-entities-name-input').fill(bankName)
  await page.getByTestId('bank-entities-code-input').fill(`E2E-${Date.now()}`)
  await page.getByRole('button', { name: 'Crear entidad' }).click()

  await expect(page.getByRole('button', { name: 'Crear entidad' })).toHaveCount(0, { timeout: 15_000 })
}

async function createCreditCardAccount(page: Page, accountName: string, bankName: string) {
  await page.goto('/portfolio')
  await expect(page.getByTestId('portfolio-form')).toBeVisible()

  await page.getByTestId('portfolio-name-input').fill(accountName)
  await page.getByTestId('portfolio-type-select').click()
  await page.getByRole('option', { name: 'Tarjeta' }).click()

  await page.getByTestId('portfolio-bank-entity-select').click()
  await page.getByRole('option', { name: bankName }).click()

  await page.getByTestId('portfolio-initial-balance-input').fill('0')
  await page.getByTestId('portfolio-submit-button').click()

  await expect(page.getByTestId('portfolio-name-input')).toHaveValue('', { timeout: 15_000 })
}

async function createCreditCard(page: Page, accountName: string, creditName: string) {
  await page.goto('/credits')
  await expect(page.getByTestId('credits-hero-create-button')).toBeVisible()

  await page.getByTestId('credits-hero-create-button').click()
  await page.getByTestId('credit-type-card-button').click()
  await expect(page.getByTestId('credit-card-form')).toBeVisible()

  await page.getByTestId('credit-card-account-select').click()
  await page.getByRole('option', { name: new RegExp(accountName) }).click()

  await page.getByTestId('credit-card-name-input').fill(creditName)
  await page.getByTestId('credit-card-limit-input').fill('3200')
  await page.getByTestId('credit-card-used-amount-input').fill('0')
  await page.getByTestId('credit-card-submit-button').click()

  await expect(page.getByTestId('credit-card-form')).toHaveCount(0, { timeout: 20_000 })
}

async function createAsset(page: Page, accountName: string, assetName: string) {
  await page.goto('/assets')
  await expect(page.getByTestId('assets-hero-create-button')).toBeVisible()

  await page.getByTestId('assets-hero-create-button').click()
  await expect(page.getByTestId('asset-form')).toBeVisible()

  await page.getByTestId('asset-name-input').fill(assetName)

  await page.getByTestId('asset-account-select').click()
  await page.getByRole('option', { name: new RegExp(accountName) }).click()

  await page.getByTestId('asset-amount-input').fill('750')
  await page.getByTestId('asset-description-input').fill(`Compra ${assetName}`)
  await page.getByTestId('asset-submit-button').click()

  await expect(page.getByTestId('asset-form')).toHaveCount(0, { timeout: 20_000 })
}

async function createBudget(page: Page, budgetName: string, categoryName?: string) {
  await page.goto('/budgets')
  await expect(page.getByTestId('budgets-create-button')).toBeVisible()

  await page.getByTestId('budgets-create-button').click()
  await expect(page.getByTestId('budget-form')).toBeVisible()

  await page.getByTestId('budget-name-input').fill(budgetName)

  if (categoryName) {
    await page.getByLabel('Categoria').click()
    await page.getByRole('option', { name: categoryName }).click()
  }

  await page.getByTestId('budget-amount-input').fill('300')
  await page.getByTestId('budget-submit-button').click()

  await expect(page.getByTestId('budget-form')).toHaveCount(0, { timeout: 15_000 })
}

async function createDebtor(page: Page, debtorName: string) {
  await page.goto('/receivables')
  await expect(page.getByTestId('receivables-new-debtor-btn')).toBeVisible()

  await page.getByTestId('receivables-new-debtor-btn').click()
  await expect(page.getByTestId('debtor-form')).toBeVisible()

  await page.getByTestId('debtor-name-input').fill(debtorName)
  await page.getByTestId('debtor-save-btn').click()

  await expect(page.getByTestId('debtor-form')).toHaveCount(0, { timeout: 15_000 })
}

async function createCreditor(page: Page, creditorName: string) {
  await page.goto('/payables')
  await expect(page.getByTestId('payables-new-creditor-btn')).toBeVisible()

  await page.getByTestId('payables-new-creditor-btn').click()
  await expect(page.getByTestId('creditor-form')).toBeVisible()

  await page.getByTestId('creditor-name-input').fill(creditorName)
  await page.getByTestId('creditor-save-btn').click()

  await expect(page.getByTestId('creditor-form')).toHaveCount(0, { timeout: 15_000 })
}

async function createReceivable(page: Page, debtorName: string, accountName: string, concept: string) {
  await page.goto('/receivables')
  await expect(page.getByTestId('receivables-new-btn')).toBeVisible()

  await page.getByTestId('receivables-new-btn').click()
  await expect(page.getByTestId('receivable-form')).toBeVisible()

  await page.getByTestId('receivable-debtor-select').click()
  await page.getByRole('option', { name: debtorName }).click()

  await page.getByTestId('receivable-account-select').click()
  await page.getByRole('option', { name: accountName }).click()

  await page.getByTestId('receivable-amount-input').fill('180')
  await page.getByTestId('receivable-concept-input').fill(concept)
  await page.getByTestId('receivable-save-btn').click()

  await expect(page.getByTestId('receivable-form')).toHaveCount(0, { timeout: 20_000 })
}

async function createPayable(page: Page, creditorName: string, accountName: string, concept: string) {
  await page.goto('/payables')
  await expect(page.getByTestId('payables-new-btn')).toBeVisible()

  await page.getByTestId('payables-new-btn').click()
  await expect(page.getByTestId('payable-form')).toBeVisible()

  await page.getByTestId('payable-creditor-select').click()
  await page.getByRole('option', { name: creditorName }).click()

  await page.getByTestId('payable-account-select').click()
  await page.getByRole('option', { name: accountName }).click()

  await page.getByTestId('payable-amount-input').fill('210')
  await page.getByTestId('payable-concept-input').fill(concept)
  await page.getByTestId('payable-save-btn').click()

  await expect(page.getByTestId('payable-form')).toHaveCount(0, { timeout: 20_000 })
}

async function createManualAlert(page: Page, title: string) {
  await page.goto('/alerts')
  await expect(page.getByTestId('alerts-create-button')).toBeVisible()

  await page.getByTestId('alerts-create-button').click()
  await expect(page.getByTestId('alerts-create-modal')).toBeVisible()

  await page.getByTestId('alerts-rule-title-input').fill(title)
  await page.getByTestId('alerts-save-rule-button').click()
  await expect(page.getByTestId('alerts-create-modal')).toHaveCount(0, { timeout: 15_000 })
}

test.describe('authenticated management connectivity', () => {
  test.skip(!credentials, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated management tests.')

  test('new portfolio account appears in transaction account selector', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const accountName = `E2E Portfolio ${Date.now()}`
    await createPortfolioAccount(page, accountName)
    await expect(page.getByText(accountName).first()).toBeVisible({ timeout: 15_000 })

    await page.goto('/transactions/new')
    await expect(page.getByTestId('transaction-form')).toBeVisible()

    const accountOption = page.locator(
      '[data-testid="transaction-source-account-select"] option',
      { hasText: accountName }
    )
    await expect(accountOption.first()).toBeVisible()
  })

  test('new admin category appears in transaction category selector', async ({ page }) => {
    await loginViaUI(page, credentials!)
    await ensureTransactionFormReady(page)

    const categoryName = `E2E Categoria ${Date.now()}`
    await createCategory(page, categoryName)
    await expect(page.getByText(categoryName).first()).toBeVisible({ timeout: 15_000 })

    await page.goto('/transactions/new?type=EXPENSE')
    await expect(page.getByTestId('transaction-form')).toBeVisible()

    const categoryOption = page.locator(
      '[data-testid="transaction-category-select"] option',
      { hasText: categoryName }
    )
    await expect(categoryOption.first()).toBeVisible()
  })

  test('new budget appears in transaction selector for matching category', async ({ page }) => {
    await loginViaUI(page, credentials!)
    await ensureTransactionFormReady(page)

    const categoryName = `E2E Presupuesto Cat ${Date.now()}`
    const budgetName = `E2E Presupuesto ${Date.now()}`

    await createCategory(page, categoryName)
    await createBudget(page, budgetName, categoryName)

    await page.goto('/transactions/new?type=EXPENSE')
    await expect(page.getByTestId('transaction-form')).toBeVisible()

    const categorySelect = page.getByTestId('transaction-category-select')
    const categoryOption = categorySelect.locator('option', { hasText: categoryName }).first()
    await expect(categoryOption).toBeVisible()

    const categoryId = await categoryOption.getAttribute('value')
    if (categoryId) {
      await categorySelect.selectOption(categoryId)
    }

    const budgetOption = page.locator(
      '[data-testid="transaction-budget-select"] option',
      { hasText: budgetName }
    )
    await expect(budgetOption.first()).toBeVisible({ timeout: 15_000 })
  })

  test('new bank entity appears in portfolio bank selector', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const bankName = `E2E Banco ${Date.now()}`
    await createBankEntity(page, bankName)
    await expect(page.getByText(bankName).first()).toBeVisible({ timeout: 15_000 })

    await page.goto('/portfolio')
    await expect(page.getByTestId('portfolio-form')).toBeVisible()

    const bankOption = page.locator(
      '[data-testid="portfolio-bank-entity-select"] option',
      { hasText: bankName }
    )
    await expect(bankOption.first()).toBeVisible()
  })

  test('can deactivate and reactivate a bank entity from catalog actions', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const bankName = `E2E Banco Estado ${Date.now()}`
    await createBankEntity(page, bankName)

    const row = page.locator('article').filter({ hasText: bankName }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    await row.getByRole('button', { name: 'Desactivar' }).click()
    await expect(row.getByText('Inactiva')).toBeVisible({ timeout: 15_000 })
    await expect(row.getByRole('button', { name: 'Activar' })).toBeVisible({ timeout: 15_000 })

    await row.getByRole('button', { name: 'Activar' }).click()
    await expect(row.getByText('Activa')).toBeVisible({ timeout: 15_000 })
    await expect(row.getByRole('button', { name: 'Desactivar' })).toBeVisible({ timeout: 15_000 })
  })

  test('can deactivate a portfolio account using modal confirmation', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const accountName = `E2E Portfolio Deactivate ${Date.now()}`
    await createPortfolioAccount(page, accountName)

    const row = page.locator('[data-testid^="portfolio-row-"]').filter({ hasText: accountName }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    const deactivateButton = row.locator('[data-testid^="portfolio-deactivate-"]')
    await deactivateButton.click()
    await expect(page.getByTestId('portfolio-deactivate-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('portfolio-deactivate-modal')).toHaveCount(0)
    await expect(deactivateButton).toBeFocused()

    await deactivateButton.click()
    await expect(page.getByTestId('portfolio-deactivate-modal')).toBeVisible()
    await page.getByTestId('portfolio-deactivate-confirm-button').click()
    await expect(page.getByTestId('portfolio-deactivate-modal')).toHaveCount(0, { timeout: 20_000 })

    await expect(row.locator('[data-testid^="portfolio-reactivate-"]')).toBeVisible({ timeout: 20_000 })
  })

  test('can delete a portfolio account using modal confirmation', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const accountName = `E2E Portfolio Delete ${Date.now()}`
    await createPortfolioAccount(page, accountName)

    const row = page.locator('[data-testid^="portfolio-row-"]').filter({ hasText: accountName }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    const deleteButton = row.locator('[data-testid^="portfolio-delete-"]')
    await deleteButton.click()
    await expect(page.getByTestId('portfolio-delete-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('portfolio-delete-modal')).toHaveCount(0)
    await expect(deleteButton).toBeFocused()

    await deleteButton.click()
    await expect(page.getByTestId('portfolio-delete-modal')).toBeVisible()
    await page.getByTestId('portfolio-delete-confirm-button').click()
    await expect(page.getByTestId('portfolio-delete-modal')).toHaveCount(0, { timeout: 20_000 })

    await expect(page.locator('[data-testid^="portfolio-row-"]').filter({ hasText: accountName })).toHaveCount(0, {
      timeout: 20_000,
    })
  })

  test('can delete a custom category using modal confirmation', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const categoryName = `E2E Categoria Delete ${Date.now()}`
    await createCategory(page, categoryName)

    const row = page.locator('[data-testid^="categories-row-"]').filter({ hasText: categoryName }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    const deleteButton = row.locator('[data-testid^="categories-delete-"]')
    await deleteButton.click()
    await expect(page.getByTestId('categories-delete-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('categories-delete-modal')).toHaveCount(0)
    await expect(deleteButton).toBeFocused()

    await deleteButton.click()
    await expect(page.getByTestId('categories-delete-modal')).toBeVisible()
    await page.getByTestId('categories-delete-confirm-button').click()
    await expect(page.getByTestId('categories-delete-modal')).toHaveCount(0, { timeout: 20_000 })

    await expect(page.locator('[data-testid^="categories-row-"]').filter({ hasText: categoryName })).toHaveCount(0, {
      timeout: 20_000,
    })
  })

  test('can delete a budget using modal confirmation', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const budgetName = `E2E Budget Delete ${Date.now()}`
    await createBudget(page, budgetName)

    const row = page.locator('[data-testid^="budget-row-"]').filter({ hasText: budgetName }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    const deleteButton = row.locator('[data-testid^="budget-delete-"]')
    await deleteButton.click()
    await expect(page.getByTestId('budgets-delete-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('budgets-delete-modal')).toHaveCount(0)
    await expect(deleteButton).toBeFocused()

    await deleteButton.click()
    await expect(page.getByTestId('budgets-delete-modal')).toBeVisible()
    await page.getByTestId('budgets-delete-confirm-button').click()
    await expect(page.getByTestId('budgets-delete-modal')).toHaveCount(0, { timeout: 20_000 })

    await expect(page.locator('[data-testid^="budget-row-"]').filter({ hasText: budgetName })).toHaveCount(0, {
      timeout: 20_000,
    })
  })

  test('can deactivate and reactivate a budget using row actions', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const budgetName = `E2E Budget Toggle ${Date.now()}`
    await createBudget(page, budgetName)

    const row = page.locator('[data-testid^="budget-row-"]').filter({ hasText: budgetName }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    await row.locator('[data-testid^="budget-deactivate-"]').click()
    await expect(row.getByText('Inactivo')).toBeVisible({ timeout: 15_000 })
    await expect(row.locator('[data-testid^="budget-reactivate-"]')).toBeVisible({ timeout: 15_000 })

    await row.locator('[data-testid^="budget-reactivate-"]').click()
    await expect(row.getByText('Activo')).toBeVisible({ timeout: 15_000 })
    await expect(row.locator('[data-testid^="budget-deactivate-"]')).toBeVisible({ timeout: 15_000 })
  })

  test('can delete a credit card using modal confirmation', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const bankName = `E2E Banco Credito ${Date.now()}`
    const accountName = `E2E Tarjeta ${Date.now()}`
    const creditName = `E2E Linea ${Date.now()}`

    await createBankEntity(page, bankName)
    await createCreditCardAccount(page, accountName, bankName)
    await createCreditCard(page, accountName, creditName)

    const card = page.locator('article').filter({ hasText: creditName }).first()
    await expect(card).toBeVisible({ timeout: 15_000 })

    const deleteButton = card.locator('[data-testid^="credit-delete-"]').first()
    await deleteButton.click()
    await expect(page.getByTestId('credits-delete-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('credits-delete-modal')).toHaveCount(0)
    await expect(deleteButton).toBeFocused()

    await deleteButton.click()
    await expect(page.getByTestId('credits-delete-modal')).toBeVisible()
    await page.getByTestId('credits-delete-confirm-button').click()
    await expect(page.getByTestId('credits-delete-modal')).toHaveCount(0, { timeout: 20_000 })

    await expect(page.locator('article').filter({ hasText: creditName })).toHaveCount(0, {
      timeout: 20_000,
    })
  })

  test('can delete an asset using modal confirmation', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const accountName = `E2E Cuenta Activo ${Date.now()}`
    const assetName = `E2E Activo ${Date.now()}`

    await createPortfolioAccount(page, accountName)
    await createAsset(page, accountName, assetName)

    const row = page.locator('[data-testid^="asset-row-"]').filter({ hasText: assetName }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    const deleteButton = row.locator('[data-testid^="asset-delete-"]').first()
    await deleteButton.click()
    await expect(page.getByTestId('assets-delete-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('assets-delete-modal')).toHaveCount(0)
    await expect(deleteButton).toBeFocused()

    await deleteButton.click()
    await expect(page.getByTestId('assets-delete-modal')).toBeVisible()
    await page.getByTestId('assets-delete-confirm-button').click()
    await expect(page.getByTestId('assets-delete-modal')).toHaveCount(0, { timeout: 20_000 })

    await expect(page.locator('[data-testid^="asset-row-"]').filter({ hasText: assetName })).toHaveCount(0, {
      timeout: 20_000,
    })
  })

  test('can create and resolve a manual alert', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const alertTitle = `E2E Manual Alert ${Date.now()}`
    await createManualAlert(page, alertTitle)

    const row = page.locator('[data-testid^="alert-row-"]').filter({ hasText: alertTitle }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    const resolveButton = row.locator('[data-testid^="alert-toggle-"]')
    await resolveButton.click()
    await expect(row.getByText('Resuelta')).toBeVisible({ timeout: 15_000 })
  })

  test('new receivable keeps linked portfolio visible in debtor detail', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const accountName = `E2E Cuenta CxC ${Date.now()}`
    const debtorName = `E2E Deudor ${Date.now()}`
    const concept = `Prestamo ${Date.now()}`

    await createPortfolioAccount(page, accountName)
    await createDebtor(page, debtorName)
    await createReceivable(page, debtorName, accountName, concept)

    const row = page.locator('[data-testid^="debtor-open-"]').filter({ hasText: debtorName }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click()

    await expect(page.getByText(accountName).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(concept).first()).toBeVisible({ timeout: 15_000 })
  })

  test('new payable keeps linked portfolio visible in creditor detail', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const accountName = `E2E Cuenta CxP ${Date.now()}`
    const creditorName = `E2E Acreedor ${Date.now()}`
    const concept = `Pago ${Date.now()}`

    await createPortfolioAccount(page, accountName)
    await createCreditor(page, creditorName)
    await createPayable(page, creditorName, accountName, concept)

    const row = page.locator('[data-testid^="creditor-open-"]').filter({ hasText: creditorName }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click()

    await expect(page.getByText(accountName).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(concept).first()).toBeVisible({ timeout: 15_000 })
  })
})
