# Polymod

A library for composing data models from any number of sources inspired by
GraphQL and Falcor.

## Install

```
npm install --save babel-polyfill polymod
```

Polymod takes advantage of new JavaScript features like async/await. Because
of this, `babel-polyfill` will need to be imported into your project or
included in your webpack configuration.

## License

[MIT License](LICENSE)

## Documentation

### Basic Usage
- [Models](#models)
- [Sources](#sources)
- [Queries](#queries)
- [Mapping source data](#mapping)
- [Mutating a document](#mutate)
- [Deleting a document](#delete)
### Advanced Usage
- [Data Descriptors](#describe)
- [Creating a document](#create)
- [Validation](#validation)
- [Non-modifiable properties](#non-modifiable)

---

<a name="models"></a>
## Models

```javascript
const { Model, MemStore, Schema, Query } = require('polymod')

const OrderDetail = Model.create()
```

<a name="sources"></a>
## Sources

Models in polymod will contain one or more sources. Sources are the primary
interface between the model and the raw data. Sources are created from Schemas,
which tell polymod how to interface with the raw data source.

A Schema should reference a specific collection of data from a data storage
mechanism. Polymod ships with `MemStore`, an in-memory data storage mechanism,
but any storage mechanism can be used provided it has the same interface.

```javascript
// Create a new in-memory storage mechanism with some
// initial data
const store = new MemStore({
	customers: [
		{
			id: 1,
			name: { first: 'John', last: 'Smith' },
			address: {
				street: '300 BOYLSTON AVE E',
				city: 'SEATTLE',
				state: 'WA',
				zip: 98012
			}
		},
		{
			id: 2,
			name: { first: 'Arthur', last: 'Jones' },
			address: {
				street: '1035 TRACTION ST',
				city: 'GREENVILLE',
				state: 'SC',
				zip: 29607
			}
		}
	],
	products: [
		{
			id: 1,
			title: 'You Don\'t Know JS: Up & Going',
			isbn: '1491924462',
			price: 4.99
		},
		{
			id: 2,
			title: 'JavaScript: The Good Parts',
			isbn: '0596517742',
			price: 21.93
		}
	],
	orders: [
		{
			id: 1,
			dateCreated: '2017-01-01',
			datePayed: null,
			shipped: false,
			customer: 1,
			products: [1, 2]
		}
	]
})

// Create schemas for each of the collections
const customers = new Schema(store, 'customers')
const products = new Schema(store, 'products')
const orders = new Schema(store, 'orders')

// Add the sources to the model
OrderDetail
	.addSource('order', orders)
	.addSource('customer', customers)
	.addSource('products', products)
```

<a name="queries"></a>
## Queries

Queries provide read functionality for a model. Every model must implement at
least one query, named "default."

A Query defines what input data is expected for the query, and what data to
fetch from the model sources. This is done with the `populate` method. Each
method is executed in the order that it is defined, and as such, the data
returned for one source, is available for use by the next population. This
makes joining multiple sources together easy.

```javascript
const defaultQuery = Query
	.create()
	// Query will accept a single value, which will be used
	// as the order id
	.input(id => ({ order: { id } }))

	// Get the order where the id matches the input
	.populate('order', ({ order }) => ({ id: order.id }))

	// Get the customer with the id stored in the order from above
	.populate('customer', ({ order }) => ({ id: order.customer }))

	// Get an array of products associated with the order
	.populate('products', ({ order }) => order.products.map(product => ({ id: product })))

// Add query as the default
OrderDetail.addQuery('default', defaultQuery)
```

Now that we have defined the model's sources, and added a default query, we can
fetch a document from the model.

```javascript
// Get a document with an order id of `1`
const document = await OrderDetail.get(1)
```

The result of this query will be an object containing the data from each source:

```javascript
{
	order: {
		id: 1,
		dateCreated: '2017-01-01',
		datePayed: null,
		shipped: false,
		customer: 1,
		products: [1, 2]
	},
	customer: {
		id: 1,
		name: { first: 'John', last: 'Smith' },
		address: {
			street: '300 BOYLSTON AVE E',
			city: 'SEATTLE',
			state: 'WA',
			zip: 98012
		}
	},
	products: [
		{
			id: 1,
			title: 'You Don\'t Know JS: Up & Going',
			isbn: '1491924462',
			price: 4.99
		},
		{
			id: 2,
			title: 'JavaScript: The Good Parts',
			isbn: '0596517742',
			price: 21.93
		}
	]
}
```

<a name="mapping"></a>
## Mapping source data

The result of query above just dumps the source data. However, this is very
useful. It would be better if we could map the source data to a document
structure that is easier to work with.

This can be accomplished in one of two ways. The first of which is the `map`
method.

```javascript
OrderDetail.map(({ order, customer, products }) => ({
	shipped: order.shipped,
	date: {
		created: order.dateCreated,
		payed: order.datePayed
	},
	customer: {
		name: customer.name,
		address: customer.address
	},
	products: products.map(product => ({
		title: product.title,
		price: product.price
	})),
	total: products.reduce((total, product) => total + product.price, 0)
}))
```

The statement creates a new document structure with data derivied from the
source data.

The result of the query `OrderDetails.get(1)` would now look like:

```javascript
{
	shipped: false,
	date: {
		created: '2017-01-01',
		payed: null
	},
	customer: {
		name: { first: 'John', last: 'Smith' },
		adddress: {
			street: '300 BOYLSTON AVE E',
			city: 'SEATTLE',
			state: 'WA',
			zip: 98012
		}
	},
	products: [
		{
			title: 'You Don\'t Know JS: Up & Going',
			price: 4.99
		},
		{
			title: 'JavaScript: The Good Parts',
			price: 21.93
		}
	],
	total: 26.92
}
```

<a name="mutate"></a>
## Mutating a document

By default, all document properties are immutable and all mutations must be
explicitly defined. This helps control how the model can be modified to protect
data integrity. Mutations are defined using the `addMutation` method, where a
mutation is given a name, and told how to modify the model sources.

```javascript
OrderDetail.addMutation('removeProductByTitle', [
	{
		source: 'order',
		operation: 'update',
		data: (title, sources) => {
			const productIds = [...sources.order.products]
			const index = sources.order.products.findIndex(product => product.title === title)

			productIds.splice(index, 1)
			return productIds
		}
	}
])
```

With this mutation, we can now remove a product from the order. `mutate`
resolves with an object, which has two properties: `document` and `error`.

```javascript
const order = await OrderDetail.get(1)
const [ updatedOrder ] = await order.mutate('removeProductByTitle', 'JavaScript: The Good Parts')
```

Result:
```javascript
{
	...
	products: [
		{
			title: 'You Don\'t Know JS: Up & Going',
			price: 4.99
		}
	],
	total: 4.99
	...
}
```

<a name="delete"></a>
## Deleting a document

Like mutations, documents can also be deleted, along with their underlying
source data. Similarly to mutations, source data, by default, cannot be
deleted; Instead, each source where this should be allowed, must be "bound."

Binding a source, allows its selector (the selection query used to fetch data)
to determine what source data is deleted along with the document. The result
of the `del` method is an object that describes the source data that
was removed.

```javascript
// Bind the order source
OrderDetail.bindSources(['order'])

// Fetch and delete a document
const order = await OrderDetail.get(1)
await order.del()
```

Result:
```javascript
[
	{
		source: 'order',
		deleted: [
			{
				id: 1,
				dateCreated: '2017-01-01',
				datePayed: null,
				shipped: false,
				customer: 1,
				products: [1, 2]
			}
		]
	}
]
```

<a name="describe"></a>
## Data descriptors

Many applications will need to explicitly define the type of data contained
within a model or document. In these cases, the method `describe` should be
used in place of `map`.

'describe' allows the ability to define document properties, that conform to a
particular type, are mutable, are required, etc.

```javascript
OrderDetail.describe({
	// Property is a Boolean value. The value will default to `false` when
	// creating a new document
	shipped: {
		type: Boolean,
		required: true,
		data: ({ order }) => order.shipped,
		default: () => false,
		mutation: {
			method: { source: 'order' data: shipped => ({ shipped }) }
		}
	},

	// Propery is an object with `created` and `payed` properties.
	// Both are Date types
	date: {
		type: {
			created: Date,
			payed: Date
		},
		data: ({ order }) => ({
			created: order.dateCreated,
			payed: order.datePayed
		}),
		default: () => ({
			created: new Date()
		})
	},

	// Property is an object with `name` and `address` properties.
	// Both are String types. The property is mutable, and its
	// mutation must accept a String type.
	customer: {
		type: {
			name: String,
			address: String
		},
		required: true,
		data: ({ customer }) => ({
			name: customer.name,
			address: customer.address
		}),
		mutation: {
			type: String,
			method: { source: 'order' data: customerId => ({ customer: customerId }) }
		}
	},

	// Property is an array of objects. Each object has the properties
	// `title` and `price`. `title` is a String type, and `price` is
	// a Number type
	products: {
		type: [{
			title: String,
			price: Number
		}],
		required: true,
		data: ({ products }) => products.map(product => ({
			title: product.title,
			price: product.price
		}))
	},

	// Property is a Number type
	total: {
		type: Number,
		data: ({ products }) => products.reduce((total, product) => total + product.price, 0)
	}
})
```

While the above is a bit more verbose than `map`, it also provides the greatest
control over the data.

When a mutation is defined for a property, a new model mutaion is created with
the same name as the property. This allows the document to be mutate in a more
expected manor:

```javascript
const order = OrderDetail.get(1)
const [ updatedOrder ] = order.mutate({
	shipped: true,
	customer: 2
})
```

<a name="create"></a>
## Creating a document

When using the data descriptors, it is also possible to create a new document
using the `create` method. When creating a new document, data will be created
using on any update or create mutation operations and default values.

```javascript
const [ document ] = OrderDetail.create({
	customer: 2,
	products: [1]
})
```

<a name="validation"></a>
## Validation

Using data descriptors also enables document validation when applying a
mutation or creating a new document. If a value is provided that does not meet
a property's requirements, an error will be returned.

```javascript
const [ document, error ] = OrderDetail.create({
	customer: 'Joe',
	products: 1
})
```

`error` will be an object with two properties: `err`, which is a JavaScript
Error object, and `data`, which contains information about which properties
failed the validation check and why.

When adding mutations with `addMutation`, validation can also be enabled by
passing a type as a parameter:

```javascript
OrderDetail.addMutation('payed', [
	{ source: 'order', data: payed => payed ? new Date() : null }
], Boolean)
```

<a name="non-modifiable"></a>
## Non-modifiable properties

It may be beneficial to have model properties that can be created, but once
created cannot be modified. To do this, `modify: false` can be added to the
property descriptor. By default every property that has a mutation is
modifiable. Using the example above, the `customer` property should not be
allowed to be modified once the order has been created. This can be achieved
by altering the property descriptor such that:

```javascript
...
customer: {
	type: {
		name: String,
		address: String
	},
	required: true,
	modify: false,
	data: ({ customer }) => ({
		name: customer.name,
		address: customer.address
	}),
	mutation: {
		type: String,
		method: { source: 'order' data: customerId => ({ customer: customerId }) }
	}
}
...
```