module.exports = {
	Model: require('./src/model'),
	Document: require('./src/document'),
	Query: require('./src/query').Query,
	QueryResult: require('./src/query').QueryResult,
	MemStore: require('./src/mem-store'),
	MemSource: require('./src/mem-source')
}