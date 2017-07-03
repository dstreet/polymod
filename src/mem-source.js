class MemSource {
	constructor(store, name) {
		this.store = store
		this.name = name
	}

	async fetch(operation, selector) {
		if (operation === 'readMany') {
			return this.store.read(this.name, selector)
		} else {
			const res = await this.store.read(this.name, selector)
			return res[0]
		}
	}

	async mutate(operations) {
		const results = []

		for (const operation of operations) {
			results.push(await this._doOperation(operation.name, operation.selector, operation.data))
		}

		return results
	}

	async _doOperation(operation, selector, data) {
		let res

		switch (operation) {
			case 'create':
				res = [await this.store.create(this.name, data)]
				break
			case 'remove':
				res = await this.store.del(this.name, selector)
				break
			default:
				res = await this.store[operation](this.name, selector, data)
				break
		}

		return res[0]
	}
}

module.exports = MemSource