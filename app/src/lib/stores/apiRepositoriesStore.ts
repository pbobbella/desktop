import { BaseStore } from './base-store'
import { AccountsStore } from './accounts-store'
import { IAPIRepository, API } from '../api'
import { Account } from '../../models/account'
import { merge } from '../merge'

export interface IAccountRepositories {
  readonly repositories: ReadonlyArray<IAPIRepository>
  readonly loading: boolean
}

export class ApiRepositoriesStore extends BaseStore {
  private accountState: ReadonlyMap<Account, IAccountRepositories> = new Map<
    Account,
    IAccountRepositories
  >()

  public constructor(private readonly accountsStore: AccountsStore) {
    super()

    this.accountsStore.onDidUpdate(async () => {
      const accounts = await this.accountsStore.getAll()
      const newState = new Map<Account, IAccountRepositories>()

      for (const account of accounts) {
        for (const [key, value] of this.accountState.entries()) {
          if (
            key.login === account.login &&
            key.endpoint === account.endpoint
          ) {
            newState.set(account, value)
            break
          }
        }
      }

      this.accountState = newState
      this.emitUpdate()
    })
  }

  private updateAccount<T, K extends keyof IAccountRepositories>(
    account: Account,
    repositories: Pick<IAccountRepositories, K>
  ) {
    this.accountState = mergeState(this.accountState, account, repositories)
    this.emitUpdate()
  }

  public async loadRepositories(account: Account) {
    const api = API.fromAccount(account)

    this.updateAccount(account, { loading: true })
    const repositories = await api.fetchRepositories()

    if (!repositories) {
      this.updateAccount(account, { loading: false })
      return
    }

    this.updateAccount(account, { loading: true, repositories })
  }

  public getState(): ReadonlyMap<Account, IAccountRepositories> {
    return this.accountState
  }
}

function mergeState<T, K extends keyof IAccountRepositories>(
  state: ReadonlyMap<Account, IAccountRepositories>,
  account: Account,
  repositories: Pick<IAccountRepositories, K>
) {
  const newState = new Map<Account, IAccountRepositories>(state)
  const existingRepositories = newState.get(account)

  newState.set(
    account,
    existingRepositories === undefined
      ? repositories
      : merge(existingRepositories, repositories)
  )

  return newState
}
