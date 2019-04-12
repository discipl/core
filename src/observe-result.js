import { take, toArray } from 'rxjs/operators'

class ObserveResult {
  constructor (observable, readyPromise) {
    this._observable = observable
    this._readyPromise = readyPromise
  }

  async takeOne () {
    let resultPromise = this._observable.pipe(take(1)).toPromise()
    await this._readyPromise
    return resultPromise
  }

  async take (amount) {
    let resultPromise = this._observable.pipe(take(amount)).pipe(toArray()).toPromise()
    await this._readyPromise
    return resultPromise
  }

  async subscribe (subscriber) {
    this._observable.subscribe(subscriber)
    await this._readyPromise
  }
}

export default ObserveResult
