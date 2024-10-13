/*
In the ancient land of Eldoria, where the skies were painted with shades of mystic hues and the forests whispered secrets of old, there existed a dragon named Zephyros. Unlike the fearsome tales of dragons that plagued human hearts with terror, Zephyros was a creature of wonder and wisdom, revered by all who knew of his existence.
*/

import { ref, onMounted, inject, watch } from "vue"
import { useClient } from "@servicestack/vue"
import { createErrorStatus } from "@servicestack/client"
import { TextToSpeech } from "dtos"
import { UiLayout, ThreadStorage, HistoryTitle, HistoryGroups, useUiLayout, icons, toArtifacts, acceptedImages } from "../utils.mjs"
import { ArtifactGallery } from "./Artifacts.mjs"
import FileUpload from "./FileUpload.mjs"

export default {
    components: {
        UiLayout,
        HistoryTitle,
        HistoryGroups,
        ArtifactGallery,
        FileUpload,
    },
    template: `
        <UiLayout>
        <template #main>
            <div class="flex flex-1 gap-4 text-base md:gap-5 lg:gap-6">
                <form ref="refForm" :disabled="client.loading.value" class="w-full mb-0" @submit.prevent="send">
                    <div class="relative flex h-full max-w-full flex-1 flex-col">
                        <div class="flex flex-col w-full items-center">
                            <fieldset class="w-full">
                                <ErrorSummary :except="visibleFields" class="mb-4" />
                                <div class="grid grid-cols-6 gap-4">
                                    <div class="col-span-6">
                                        <TextareaInput inputClass="h-48" id="text" v-model="request.text" />
                                    </div>
                                    <div class="col-span-6 sm:col-span-3">
                                        <TextInput type="number" id="seed" v-model="request.seed" min="0" />
                                    </div>
                                    <div class="col-span-6 sm:col-span-3">
                                        <TextInput id="tag" v-model="request.tag" placeholder="Tag" />
                                    </div>
                                </div>
                            </fieldset>
                        </div>
                        <div class="mt-4 mb-8 flex justify-center">
                            <PrimaryButton :key="renderKey" type="submit" :disabled="!validPrompt()">
                                <span class="text-base font-semibold">Submit</span>
                            </PrimaryButton>
                        </div>
                    </div>
                </form>
            </div>
            
            <div  class="pb-20">
                
                <div v-if="client.loading.value" class="mt-8 mb-20 flex justify-center items-center">
                    <Loading class="text-gray-300 font-normal" imageClass="w-7 h-7 mt-1.5">processing image...</Loading>
                </div>                                

                <div v-for="result in getThreadResults()" class="w-full ">
                    <div class="flex items-center justify-between">
                        <span class="my-4 flex justify-center items-center text-xl underline-offset-4">
                            <span>{{ result.request.image }}</span>
                        </span>
                        <div class="group flex cursor-pointer" @click="discardResult(result)">
                            <div class="ml-1 invisible group-hover:visible">discard</div>
                            <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="currentColor" d="M12 12h2v12h-2zm6 0h2v12h-2z"></path><path fill="currentColor" d="M4 6v2h2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8h2V6zm4 22V8h16v20zm4-26h8v2h-8z"></path></svg>
                        </div>
                    </div>   
                    
                    <ArtifactGallery :results="toArtifacts(result)">
                        <template #bottom="{ selected }">
                            <div class="z-40 fixed bottom-0 gap-x-6 w-full flex justify-center p-4 bg-black/20">
                                <a :href="selected.url + '?download=1'" class="flex text-sm text-gray-300 hover:text-gray-100 hover:drop-shadow">
                                    <svg class="w-5 h-5 mr-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 20h12M12 4v12m0 0l3.5-3.5M12 16l-3.5-3.5"></path></svg> 
                                    download 
                                </a>
                                <div @click.stop.prevent="toggleIcon(selected)" class="flex cursor-pointer text-sm text-gray-300 hover:text-gray-100 hover:drop-shadow">
                                    <svg :class="['w-5 h-5 mr-0.5',selected.url == threadRef.icon ? '-rotate-45' : '']" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m14 18l-8 8M20.667 4L28 11.333l-6.38 6.076a2 2 0 0 0-.62 1.448v3.729c0 .89-1.077 1.337-1.707.707L8.707 12.707c-.63-.63-.184-1.707.707-1.707h3.729a2 2 0 0 0 1.448-.62z"/></svg>
                                    {{selected.url == threadRef.icon ? 'unpin icon' : 'pin icon' }}
                                </div>
                            </div>
                        </template>
                    </ArtifactGallery>
                </div>
            </div>        
        </template>
        
        <template #sidebar>
            <HistoryTitle :prefix="storage.prefix" />
            <HistoryGroups :history="history" v-slot="{ item }" @save="saveHistoryItem($event)" @remove="removeHistoryItem($event)">
                <Icon class="h-5 w-5 rounded-full flex-shrink-0 mr-1" :src="item.icon ?? icons.image" loading="lazy" :alt="item.model" />
                <span :title="item.title">{{item.title}}</span>
            </HistoryGroups>
        </template>
    </UiLayout>
    `,
    setup() {
        const client = useClient()
        const routes = inject('routes')
        const refUi = ref()
        const refForm = ref()
        const refImage = ref()
        const ui = useUiLayout(refUi)
        const renderKey = ref(0)

        const storage = new ThreadStorage(`txt2spch`, {
            text: '',
            tag: '',
            seed: '',
        })
        const error = ref()

        const prefs = ref(storage.getPrefs())
        const history = ref(storage.getHistory())
        const thread = ref()
        const threadRef = ref()

        const validPrompt = () => !!request.value.text
        const refMessage = ref()
        const visibleFields = 'text'.split(',')
        const request = ref(new TextToSpeech())
        const activeModels = ref([])

        function savePrefs() {
            storage.savePrefs(Object.assign({}, request.value, { tag:'' }))
        }
        function loadHistory() {
            history.value = storage.getHistory()
        }
        function saveHistory() {
            storage.saveHistory(history.value)
        }
        function saveThread() {
            if (thread.value) {
                storage.saveThread(thread.value)
            }
        }

        async function send() {
            console.log('send', validPrompt(), client.loading.value)
            if (!validPrompt() || client.loading.value) return

            savePrefs()
            console.debug(`${storage.prefix}.request`, Object.assign({}, request.value))

            error.value = null
            
            const api = await client.api(request.value, { jsconfig: 'eccn' })
            /** @type {GenerationResponse} */
            const r = api.response
            if (r) {
                console.debug(`${storage.prefix}.response`, r)

                if (!r.outputs?.length) {
                    error.value = createErrorStatus("no results were returned")
                } else {
                    const id = parseInt(routes.id) || storage.createId()
                    thread.value = thread.value ?? storage.createThread(Object.assign({
                        id: storage.getThreadId(id),
                        title: request.text,
                    }, request.value))

                    const result = {
                        id: storage.createId(),
                        request: Object.assign({}, request.value),
                        response: r,
                    }
                    thread.value.results.push(result)
                    saveThread()

                    if (!history.value.find(x => x.id === id)) {
                        history.value.push({
                            id,
                            title: thread.value.title,
                            icon: r.outputs[0].url
                        })
                    }
                    saveHistory()

                    if (routes.id !== id) {
                        routes.to({ id })
                    }
                }

            } else {
                console.error('send.error', api.error)
                error.value = api.error
            }
        }

        function getThreadResults() {
            const ret = Array.from(thread.value?.results ?? [])
            ret.reverse()
            return ret
        }

        function selectRequest(req) {
            Object.assign(request.value, req)
            ui.scrollTop()
        }

        function discardResult(result) {
            thread.value.results = thread.value.results.filter(x => x.id != result.id)
            saveThread()
        }

        function toggleIcon(item) {
            threadRef.value.icon = item.url
            saveHistory()
        }

        function onRouteChange() {
            console.log('onRouteChange', routes.id)
            refImage.value?.clear()
            loadHistory()
            if (routes.id) {
                const id = parseInt(routes.id)
                thread.value = storage.getThread(storage.getThreadId(id))
                threadRef.value = history.value.find(x => x.id === parseInt(routes.id))
                console.debug('thread', thread.value, threadRef.value)
                if (thread.value) {
                    Object.keys(storage.defaults).forEach(k =>
                        request.value[k] = thread.value[k] ?? storage.defaults[k])
                }
            } else {
                thread.value = null
                Object.keys(storage.defaults).forEach(k => request.value[k] = storage.defaults[k])
            }
        }

        function updated() {
            onRouteChange()
        }

        function saveHistoryItem(item) {
            storage.saveHistory(history.value)
            if (thread.value && item.title) {
                thread.value.title = item.title
                saveThread()
            }
        }

        function removeHistoryItem(item) {
            const idx = history.value.findIndex(x => x.id === item.id)
            if (idx >= 0) {
                history.value.splice(idx, 1)
                storage.saveHistory(history.value)
                storage.deleteThread(storage.getThreadId(item.id))
                if (routes.id == item.id) {
                    routes.to({ id:undefined })
                }
            }
        }


        watch(() => routes.id, updated)
        watch(() => [
            request.value.seed,
            request.value.tag,
        ], () => {
            if (!thread.value) return
            Object.keys(storage.defaults).forEach(k =>
                thread.value[k] = request.value[k] ?? storage.defaults[k])
            saveThread()
        })

        onMounted(async () => {
            updated()
        })

        return {
            refForm,
            refImage,
            storage,
            routes,
            client,
            history,
            request,
            visibleFields,
            validPrompt,
            refMessage,
            activeModels,
            thread,
            threadRef,
            icons,
            send,
            saveHistory,
            saveThread,
            toggleIcon,
            selectRequest,
            discardResult,
            getThreadResults,
            saveHistoryItem,
            removeHistoryItem,
            toArtifacts,
            acceptedImages,
            renderKey,
        }
    }
}
