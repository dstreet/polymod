# Polymod

![Travis CI](https://travis-ci.org/dstreet/bento-box.svg?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/dstreet/polymod/badge.svg)](https://snyk.io/test/github/dstreet/polymod)
[![npm](https://img.shields.io/npm/v/polymod.svg)]()

A library for composing data models from any number of sources. Inspired by
GraphQL and Falcor.

## Install

```
npm install --save polymod
```

## License

[MIT License](LICENSE)

## Documentation

### Defining a model
- [Introduction](#introduction)
- [Models](#models)
- [Sources](#sources)
- [Queries](#queries)
- [Mutations](#mutation)
### Interacting with a model
- [get()](#get)
- [query()](#query)
- [mutate()](#mutate)
- [create()](#create)
- [remove()](#remove)
- [describe()](#describe)

---

<a name="introduction"></a>
## Introduction

Polymod is a Node.js library for composing application data models. Unlike
other data modeling libraries, such as Mongoose or Sequelize, Polymod is
agnostic and is designed to interface with any data source so long as it
conforms to a simple source interface. Additionally, each source in a Polymod
model can come from a different data source. For instance, an application may
need to pull data from a Postgres database as well as related session
information from a Redis store. Similarly, an application may be an interface
between two or web services. A Polymod model could consume resources from
multiple RESTful APIs.

<a name="models"></a>
## Models

A `Model` in Poly defines the data sources, queries, mutations, and data
structure for a data model.

```javascript
const { Model, Query } = require('polymod')

const OrderDetail = Model
	.create()

	// Add sources
	.addSource('order', new MemSource(store, 'orders'))
	.addSource('customer', new MemSource(store, 'customers'))
	.addSource('products', new MemSource(store, 'products'))
	
	// Add the default query
	.addQuery('default', orderQuery)

	// Add a mutation
	.addMutation('ship', shipOrder)

	// Describe the data structure
	.describe({
		shipped: {
			type: Boolean,
			required: true,
			default: () => false,
			data: ({ order }) => order.shipped
		},
		date: {
			type: {
				created: Date,
				payed: Date
			},
			default: () => ({ created: new Date() }),
			data: ({ order }) => ({
				created: order.dateCreated,
				payed: order.datePayed
			})
		},
		customer: {
			type: { name: String, address: String },
			required: true,
			data: ({ customer }) => ({
				name: customer.name,
				address: customer.address
			})
		},
		products: {
			type: [{ title: String, price: Number }],
			required: true,
			data: ({ products }) => products.map(product => ({
				title: product.title,
				price: product.price
			}))
		},
		total: {
			type: Number,
			data: ({ products }) => products.reduce((total, product) => {
				return total + product.price
			}, 0)
		}
	})
```

In this example, the model, `OrderDetail` defines data from three in-memory
sources: `orders`, `customers`, and `products`. A default query is added to
fetch the data from the sources (more on queries below), a mutation is added
to ship an order (more on mutations below), and the data structure is defined
with the following properties: `shipped`, `date`, `customer`, `products`, and
`total`. Each of these properties defines a `data` function, which is used to
transform the source data to the final document property. Three other
attributes are defined on some of the data structure properties:

- `type`: Defines the schema type of the property
- `default`: A function to set the default value of a property
- `required`: Whether the property is required or not

All of these properties, including `data` are optional. If `data` is not
defined, then the property is considered write-only.


<a name="sources"></a>
## Sources

Sources are the interface between the model and the data sources. Polymod
ships with a single source, `MemSource`, which interfaces with the
in-memory storage provided by `MemStore`. Additionally, every model created
with Polymod also implements the source interface, allowing models to also
be used as sources for other models.

Creating a new source for use with Polymod is fairly straight forward.
Sources are objects, which implement two methods: `fetch` and `mutate`.

The `fetch` method takes two parameters:

- `operation`: The source operation to perform (i.e. 'read')
- `selector`: The selector used to fetch the data

The `mutate` method takes a single parameter:

- `operations`: An array of operations to be performed on the source.
                See mutations for more information.


<a name="queries"></a>
## Queries

Polymod queries are the interface for fetching a model's data from its sources.
These are defined using the `Query` class. Every model must have at least one
query, the 'default' query.

```javascript
const orderQuery = Query
	.create()
	.addPopulation({
		name: 'order',
		operation: 'read',
		selector: ({ input }) => ({ id: input })
	})
	.addPopulation({
		name: 'customer',
		operation: 'read',
		requires: ['order'],
		selector: ({ order }) => ({ id: order.customer })
	})
	.addPopulation({
		name: 'products',
		operation: 'read',
		requires: ['order'],
		selector: ({ order }) => order.products.map(product => ({ id: product }))
	})
```

Queries define populations, which instruct the model on how to fetch data from
a the source. A population is an object with the following properties:

- `name`: The source name
- `operation`: The source operation to use
- `requires`: The populations which must be complete before this population
- `selector`: A function that takes any available input and source data and
              returns a selector for the source


<a name="mutations"></a>
## Mutations

By default Polymod sources are immutable. In order to allow source data to be
mutated, mutations need to be defined by the model. Mutations are defined as an
array of operations by source.

```javascript
const shipOrder = [
	{
		source: 'post',
		operations: (input, { post }) => ([
			{
				name: 'update',
				selector: { id: post.id },
				data: { shipped: true }
			}
		]),
		results: ([ post ]) => post
	}
]
```

The mutation array should contain objects with the following properties:

- `source`: The source being mutated
- `operations`: A function returning an array of operations
- `results`: A function that returns data from the operations

The `operations` function takes the mutation input data, and object containing
the existing source data. The function should return an array of operations,
which is an object containing the operation name, the mutation
selector (optional), and the data to be mutated (also optional).

The `results` function is passed an array with each of the operation results
as an element in the array.


<a name="get"></a>
## get()

Every model has a `get` method, which executues the default query with the
given input. The returned value should either be a `Document` or an array
of `Document`s. The data for a document can be retrieved using the `data`
property.

```javascript
const doc = await OrderDetail.get(1)

console.log(doc.data)
/*
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
*/
```


<a name="query"></a>
## query()

The `query` method executes a named query with the given input. For example,
the default query could also be executed as and the result is the same:

```javascript
const doc = await OrderDetail.query('default', 1)
```


<a name="mutate"></a>
## mutate()

The `mutate` method allows access to the model's mutations and can be called in
one of two ways:

- `mutate(name, data)`: This will execute the mutation with name `name`
- `mutate(dataObject)`: This will treat each property in `dataObject` as a
                        mutation. In order to do this, the property name
						must be a defined mutation.

```javascript
const [ newDoc, error ] = await doc.mutate('ship')
```

In either instance, the returned value of the `mutate` method is an array with
two elements: the new document, and an error if the mutation failed for some
reason. If the mutation was successful, `error` will be undefined. However,
if there was an error, `newDoc` will be null.


<a name="create"></a>
## create()

The `create` method, as its name suggests, is used to create new model
documents. However, in order to create documents, an initializer needs to be
defined for the model. This is done using the `setInitializer` model method.

```javascript
OrderDetail.setInitializer([
	{
		source: 'order',
		operations: input => ([
			{
				name: 'create'
			}
		]),
		results: ([ order ]) => order
	}
], {
	customer: Number,
	products: [Number]
})
```

The initializer is simply a special mutation that is called to mutate the data
sources as needed. The second, and optional argument, is the type schema for
input data. If the model has a descriptor, the properties defined here, will
override any types in the descriptor.

```javascript
const [ doc, error ] = await OrderDetail.create({
	customer: 2,
	products: [1]
})
```


<a name="remove"></a>
## remove()

`remove` is a method of a Document instance, and like the `create` method, a
special mutation needs to be defined before documents can be removed. This is
achieved using the `setRemove` method.

```javascript
OrderDetail.setRemove([
	{
		source: 'order',
		operations: ({ input }) => ([
			{
				name: 'remove',
				selector: { id: input }
			}
		])
	}
])
```

The returned value from the `remove` method is an object with properties for
each mutated source, and values containing the operation results.

```javascript
const removed = await doc.remove()
```


<a name="describe"></a>
## describe()

When calling the `describe` method without any parameters, the model will return
the defined data descriptor types.

```javascript
console.log(OrderDetail.describe())

/*
{
	shipped: {
		type: Boolean,
		required: true
	},
	date: {
		type: {
			created: Date,
			payed: Date
		}
	},
	customer: {
		type: { name: String, address: String },
		required: true
	},
	products: {
		type: [{ title: String, price: Number }],
		required: true
	},
	total: {
		type: Number
	}
}
*/
```