const uuid = require('uuid')
const validate = require('uuid-validate')
const sift = require('sift')

class MemStore {
	constructor(initData = {}) {
		this._data = initData
	}

	async create(source, data) {
		const createData = {
			id: uuid(),
			...data
		}

		if (!this._data.hasOwnProperty(source)) {
			this._data[source] = []
		}

		this._data[source].push(createData)

		return createData
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
				pushDoc = { ...doc, ...data }
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