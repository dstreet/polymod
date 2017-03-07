class Field {
	static FromSchemaField(schema, getField, _selectField) {
		const selectField = _selectField || schema.keyField

		return new Field(schema, {
			select: key => ({ [selectField]: key }),
			get: doc => doc[getField],
			commit: data => ({ [getField]: data })
		})
	}

	static LinkDocument(key, related, join, fieldMap, relationship) {
		async function getOneRelated(relatedId) {
			return await related.schema.read({ [related.select || related.schema.keyField]: relatedId })
		}

		async function getManyRelated(relatedIds) {
			const docs = []
			
			for (let relatedId of relatedIds) {
				docs.push(await related.schema.read({ [related.select || related.schema.keyField]: relatedId }, true))
			}

			return docs
		}

		return new Field(key.schema, {
			select: keyVal => ({ [key.select || key.schema.keyField]: keyVal }),
			getRaw: doc => doc[join],
			get: async doc => {
				const relatedId = doc[join]
				let relatedDocs

				if (relationship === 'ONE_TO_MANY') {
					relatedDocs = await getManyRelated(relatedId)
					
					return relatedDocs.map(fieldMap)
				}

				relatedDocs = await getOneRelated(relatedId)
				return relatedDocs.map(fieldMap)[0]
			},
			set: async relatedId => {
				let relatedDocs

				if (relationship === 'ONE_TO_MANY') {
					relatedDocs = await getManyRelated(relatedId)
					
					return relatedDocs.map(fieldMap)
				}

				relatedDocs = await getOneRelated(relatedId)
				return relatedDocs.map(fieldMap)[0]
			},
			commit: relatedId => ({ [join]: relatedId })
		})
	}

	constructor(schema, { select, get, set, commit, multi }) {
		this.schema = schema
		this.select = select
		this.set = set
		this.get = get
		this.commit = commit
		this._multi = multi || false
		this._cachedDocuments
	}

	// async get(val, all) {
	// 	const documents = await this.schema.read(this.select(val))

	// 	if (this._multi || all) {
	// 		this.data = []

	// 		for (const document of documents) {
	// 			this.data.push(this._get(document))
	// 		}

	// 		this._cachedDocuments = documents
	// 	} else {
	// 		this.data = await this._get(documents[0])
	// 		this._cachedDocuments = documents[0]
	// 	}

	// 	return this.data
	// }

	get cached() {
		return this._cachedDocuments
	}

	// async commit(selector, data) {
	// 	const updatedDocs = await this.schema.update(selector, this._commit(data))
	// 	this._cachedDocuments = updatedDocs[0]

	// 	return this
	// }

	async commitNew(data) {
		const updatedDocs = await this.schema.create(this._commit(data))
		this._cachedDocuments = updatedDocs[0]

		return this
	}
}

module.exports = Field