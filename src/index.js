module.exports = {
	Model: require('./model'),
	Document: require('./document'),
	Query: require('./query').Query,
	QueryResult: require('./query').QueryResult,
	MemStore: require('./mem-store'),
	MemSource: require('./mem-source')
}