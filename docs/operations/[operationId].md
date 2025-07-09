---
aside: false
outline: false
title: API Reference
---

<script setup>
import { useRoute } from 'vitepress'

const route = useRoute()

const operationId = route.data.params.operationId
</script>

<OAOperation :operationId="operationId" />
