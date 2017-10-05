const uuid = require('uuid')
const validate = require('uuid-validate')
const sift = require('sift')

class MemStore {
	constructor(initData = {}) {
		this._data = initData
	}

	async create(source, data) {
		const createData = [].concat(data).map(item => ({
			id: uuid(),
			...item
		}))

		if (!this._data.hasOwnProperty(source)) {
			this._data[source] = []
		}
		
		createData.forEach(item => this._data[source].push(item))

		return Array.isArray(data) ? createData : createData[0]
	}

	async read(source, selector) {
		if (!this._data.hasOwnProperty(source)) {
			return []
		}

		if (typeof selector === 'function') {
			return this._data[source].filter(selector)
		}

		return sift(selector, this._data[source])
	}

	async update(source, selector, data) {
		const updated = []
		const docs = this._data[source].reduce((acc, doc) => {
			let matched = true
			let pushDoc

			if (typeof selector === 'function') {
				matched = selector(doc)
			} else {
				matched = sift(selector)(doc)
			}

			if (matched) {
				pushDoc = Object.keys(data).reduce((acc, key) => {
					if (key === '$push') {
						return Object.keys(data.$push).reduce((pAcc, pKey) => ({
							...pAcc,
							[pKey]: Array.isArray(pAcc[pKey]) ? pAcc[pKey].concat(data.$push[pKey]) : [data.$push[pKey]]
						}), { ...acc })
					} else {
						return {
							...acc,
							[key]: data[key]
						}
					}
				}, doc)

				updated.push(pushDoc)
			} else {
				pushDoc = doc
			}

			return [...acc, pushDoc]
		}, [])

		this._data[source] = docs

		return updated
	}

	async del(source, selector) {
		const deleted = []
		const docs = this._data[source].reduce((acc, doc) => {
			let matched = true

			if (typeof selector === 'function') {
				matched = selector(doc)
			} else {
				matched = sift(selector)(doc)
			}

			if (matched) {
				deleted.push(doc)
				return acc
			} else {
				return [...acc, doc]
			}
		}, [])

		this._data[source] = docs

		return deleted
	}

	isKeyValue(val) {
		return validate(val)
	}
}

module.exports = MemStore
