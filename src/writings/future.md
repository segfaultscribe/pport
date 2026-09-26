---
layout: post.njk
title: A glimpse of the Future (Go pattern) 
dateDisplay: Sept, 2026
category: tech
description: A cache, A channel and concurrent request calls.
---

Let me present an interesting scenario:

You have a function that makes an http request to a given address.

````go
func Fetch(address string)
````

You want to optimize your app so you decide to cache it and any follow up requests will hit the cache.

```go
func (c *Cache) Fetch(address string)
```

But the catch is that you don't want to make sequential calls. Instead, you want to make these requests in parallel. Since we're using go, the obvious answer is goroutines. 

I'll also give you another requirement that since we're caching address we've already seen, we must also make sure we do not, ever, fetch the same address again if it has already been fetched once. 

So the obvious path of doing this is we check the cache -> if the address is in the cache, we return the result stored in the cache OR we make the request call.

```go
func (c *Cache) Fetch(address string) (string, error){
	data, ok := c.addressMap[address]
		
	if ok {
		// cache hit
		return data, nil
	}
	// the actual call using client
	data, err := client.Get(address)
	// map it since it's the first time we're seeing the address
	c.addressMap[address] = data
	
	if err!=nil {
		return "", err
	}
	
	return data, nil
}
```

This is almost too simple. But, the fact that we want to run multiple Fetch functions in parallel makes this a lot more interesting. As you can see, we have a map for the cache and maps in go aren't concurrency safe. So we need Locks.

We could:

add a Lock to the cache struct

```go
type Cache struct {
    mu   sync.Mutex
    addressMap map[string]string
}
```

use it to protect our maps

```Go
func (c *Cache) Fetch(address string) (string, error){
	c.mu.Lock()
	data, ok := c.addressMap[address]
	c.mu.Unlock()
	
	if ok {
		// cache hit
		return data, nil
	}
	
	data, err := client.Get(address)
	// map it since it's the first time we're seeing the address
	c.mu.Lock()
	c.addressMap[address] = data
	c.mu.Unlock()
	
	if err!=nil {
		return "", err
	}
	
	return data, nil
}
```

Easy right? Not quite...

We did not acheive anything here. Sure, the maps are accessed safely, but the actual request call `data, err := client.Get(address)` isn't protected at all. That means a function could read the map securely find that the address isn't in the map and then proceed to make the request while another function at the same time completes the request and writes into the map safely. So the address now exists in the map and our first function is going to make the request again which breaks our requirement.

So now for the obvious part: If we need to protect the request call then why not lock it. Well, that is a great idea IF we wanted sequential execution. We are making the request parallel for a reason and hence our solution to protecting the requests can't be to de-parallelize our request calls. 

So, what do we do now? Well, all it takes is a simple yet intricate pattern of locks and a channel. 

We'll create a struct that represents the address:

```go
type event struct {
	done chan struct{} // you know what this is! hint: what are unbuffered channels used for usually?
	res string
	err error
}
``` 

and the map changes to

```Go
type Cache struct {
    mu   sync.Mutex
    cMap map[string]*event //THIS!
}
```

Now we'll modify our fetch function to use this struct. What we're going to do is to use the channel as a mechanism to simply bypass the problem of multiple request call. The unbuffered done channel will block until the sender closes it and we'll put that aspect to use.

```go
func (c *Cache) Fetch(address string) (*Response, error) {
    c.mu.Lock()
    e := c.cMap[address]
    if e == nil {
        // First goroutine for this address: register pending entry
        e = &event{done: make(chan struct{})}
        c.cMap[address] = e
        c.mu.Unlock()
        // Perform fetch outside the lock
        e.res, e.err = c.client.Get(address)
        // Signal all waiting goroutines that the data is ready
        close(e.done)
        return e.res, e.err
    }
    // Subsequent goroutines for the same address:
    c.mu.Unlock()
    // Wait until the first goroutine closes the channel
    <-e.done
    return e.res, e.err
}
```

The important part here to note is what we're trying to acheive:
- we want to read the map safely.
- we want to make sure only the first goroutine makes the request call for a specific address.
- we want to eliminate locking the request call itself.

In order to do this gracefully, we use the combination of locks and channels. We lock the map and then we check if the address is already seen. If NOT then we enter the `if e == nil` condition. `NOTE: only the first goroutine to read the map and find out the address isn't seen will enter the if condition due to the lock.` Once inside the condition, we create an instance of the event struct with the channel and map the address to that instance instead of the result.

Now we can safely unlock the mutex cause any other goroutine reading the map from now on will find that the key is present. The response / data isn't there yet but the key is present and that's the interesting part. we're literally holding a dummy struct in place to make sure other goroutine don't go making calls we don't want. We can now comfortably call the request outside any locks because for other addresses the request calls happens parallelly but for the same address the goroutines never enter the `if e == nil` condition at all!

Inside the condition we complete the process by making the request call and adding the response data and error to the event fields. The other goroutine which never got into the condition waits on `<-e.done`  which blocks until we close the channel inside the condition. The goroutines now all read an `e` struct that is populated by the response and error from the request call and only one goroutine did ever make the call.

Now, this is pretty easy but if you're still confused, just keep wondering why we're using a channel in the solution and you'll reach the understanding yourself. This might sound like a hack the first time you encounter it but it's not! It's idiomatic Go, rooted in a property of channels that Rob Pike and the early Go team leaned on heavily: *closing a channel is a broadcast, not a handoff.*