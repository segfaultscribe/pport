---
layout: post.njk
title: An introduction to observability 
dateDisplay: Sept, 2026
category: tech
description: A familiarization to observability in deployed/distributed systems.
---

Once you have an application up and running and working exactly as you intended it to(often times this is a probability), you'll want to deploy it. But once you deploy, the responsibilities you have with that application increases tenfold. Now you have an additional requirement that the app stays online without any issues. 

Observability is a part of development when you make sure you can see and understand everything that happens in your application. Imagine you're running a successful distributed microservice system and one fine day you get woken up at 3:00 AM by the bells tolling because a few of your servers crashed. You'd probably want to know what happened, right? Well, that's the part of observability, it simply tells you everything you need to know about the system.

Now for someone who is starting, out this can feel like a maze, there is plenty of software in this area and you might wonder why we need all of them: prometheus, logstash, grafana suite and loki, elasticsearch, Tempo, Opentelemetry, Kibana and a lot more.

These tools work on specific aspects of observability that you'll see.

### The Basics

Most of us build monoliths, applications contained in a single folder or project, but then most services, application in the world are distributed with microservice or make calls to entire other systems.In industry literature, the "Three Pillars of Observability" are officially **Metrics**, **Logs**, and **Traces** (Spans are the building blocks of Traces).

***Metrics***: Numeric, aggregated data measured over time intervals (e.g., CPU usage %, memory consumption, requests per second).

***Logs***: An event recorded at a single discrete point in time by a single component. eg: log("controller hit"), log("successfully parsed file"). Logs are very important and should be added to every system even it's a monolith. It tells you the flow is correctly working. Logging at critical points in your software converts a needle in a haystack problem to an elephant in a bathtub one.

***Span*:** a continuous segment of execution time within a single operation with a start time, duration and metadata.

***Trace***: A directed acyclic graph of spans that represents the end-to-end journey of a single request across every network hop. Traces become extremely important in microservice based system or systems which call other services through the network.

In short: `Metrics tell you THAT a problem exists, Traces show you WHERE it is happening, and Logs tell you WHY it broke.`

The `traceID` and `spanID` is a context that must be serialized and injected into the headers sent over the wire.

Why are traces important? Well, consider a request in your system. Your system knows about the request and it's flow. The endpoint -> controller -> service -> repository -> Response back from controller. However, if you were to handover this request to a separate service outside of your network, how does that server know the context of this request? `traceID` helps "trace" the request over several services spread across the network. Following the `traceID` you can then map out the explicitly flow of the request as a graph or tree and analyze it in the case something goes wrong.

A place where juniors confuse themselves is trying to understand `traceID` in the context of a monolith. Request hits controller -> service -> repository -> back to controller. This process exists in the same system and the request cycle is within a single thread and hence context is maintained locally, however cross network requests is where tracing becomes significant.  Therefore in a contained monolith you don't need to implement tracing unless you have pipelines where your monolith makes cross network calls to other services or you have extensive background jobs that run in different trace and time.

### The Observability Ecosystem

Simplistically, you can split Observability layer into 4:
- application
- collection/aggregation
- storage
- Visualization

**Application layer**: This is where you write the code, your project your repo. It consists of the **logs** in your system(via stdout, loggers like winston etc) and the **trace spans**(Opentelemetry SDK).

**Collection/Aggregation**: Collection systems that aggregate logs and traces emiited by your application. eg: Logstash, Promtail for logs. Opentelemetry Collector, Jaeger for traces.

Storage: The collected logs and traces must be stored in a database like layer for efficient and fast retrieval. eg: Elasticsearch, Grafana Loki for logs, Tempo, Jaeger for traces.

Visualization: UI layer for viewing logs inside a dashboard giving maintainers a surface level view of how the software is holding up. eg: Kibana, Grafana.

### Stacks

Two most used stacks in observability are ELK and LGT

##### ELK

**Elasticsearch**: A search storage engine built on top of Apache Lucene. Elasticsearch builds inverted indexes for string fields and structured keys across every log document. That should tell you that this is extremely fast but uses massive amounts of RAM and disk. That's quite the tradeoff to consider when choosing log storage.

**Logstash**: An ingestion pipeline that takes in raw log strings and structures them using grok(not the twitter{now X} one), but if your app outputs **JSON directly to stdout** (structured logging), Logstash skips regex entirely and parses the JSON natively.

**Kibana**: The visualization dashboard used to query Elasticsearch.

##### LGT

**Loki**: A log storage/aggregator engine like Elastic search but operated very differently. Loki indexes only the metadata labels of the log and not each word making it less faster than elastic search but more efficient in terms of utilizing the RAM and disk. The raw log text is compressed and stored cheaply.

**Tempo**: High-throughput, low-cost distributed tracing backend that stores raw trace files.

Grafana: visualization UI that connects to multiple data sources

##### Tradeoff

Assume you were deciding between elasticsearch and loki for your application. Would you simply choose one? Unlike some other tools that you can choose based on what you have worked with earlier, choosing between these two must be negotiated with. 

Elasticsearch like we discussed before stores every string field as an inverted index. So, a system that produces 10TB of logs each day will burn through RAM and disk working with ES.

While Loki, is much more forgiving in the storage sense it indexes only the metadata and hence is comparatively slower on retrieval. 

### Usability

Assume you're running an LGT stack and a user reports "I clicked 'Purchase' and got a 500 internal server error."

In order to debug you can simply pull the traceID of the request from grafana and query Loki to produce the entire logs which you can then analyze to find the problem.

