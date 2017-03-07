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

	get cached() {
		return this._cachedDocuments
	}
}

module.exports = Field