// ==UserScript==
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @name         BOT de Slot - API 
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  BOT para reserva de SLOTS 
// @author       Ataide
// @match        https://sigma.decea.mil.br/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let isRunning = false;
    let slotFound = false;
    let isReserving = false;
    let latestWicketPrefix = null;
    let wicketCaptured = false;
    let reservationAttemptCount = 0;

    const EXECUTION_SECONDS = 4;
    const REQUEST_QUANTITY = 4;
    const REQUEST_TIMEOUT_MILLIS = 350;

    const REFRESH_BTN_XPATH = '/html/body/div[1]/div/div[2]/div/div/div/div/div[3]/table/tbody/tr/td[1]/table[1]/tbody/tr[2]/td/table/tbody/tr/td[4]/div/input';

    const SEARCH_URL_TEMPLATE = "https://sigma.decea.mil.br/slot/?wicket:interface={{wicketId}}:main:contentPanel:searchPanel:formSearch:slotAllocationModal:content:rightPanelForm:freeSlotGridPanel:btSearchGrid::IActivePageBehaviorListener:2:-1";
    const RESERVE_URL_TEMPLATE = "https://sigma.decea.mil.br/slot/?wicket:interface={{wicketId}}:main:contentPanel:searchPanel:formSearch:slotAllocationModal:content:rightPanelForm:actionTaskBar:divBtReserveAction:btReserveActivation::IActivePageBehaviorListener:2:-1";

    let intervalId = null;
    let timeoutIds = [];

    function clearAllTimers() {
        if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
        }
        timeoutIds.forEach(id => clearTimeout(id));
        timeoutIds = [];
        isRunning = false;
        console.log("[BOT_SLOT] Todos timers cancelados. Bot parado.");
    }

    function buildUrlFromTemplate(template) {
        if (!latestWicketPrefix) return null;
        // Primeiro request usa o wicket correto; outros usam string inválida para não reenviar
        if (reservationAttemptCount > 0) return template.replace("{{wicketId}}", "INVALIDO-000");
        return template.replace("{{wicketId}}", latestWicketPrefix);
    }

    function clickRefreshButton() {
        const refreshBtn = document.evaluate(REFRESH_BTN_XPATH, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (!refreshBtn) {
            console.error("[BOT_SLOT] Botão refresh não encontrado para clique.");
            return false;
        }

        refreshBtn.click();
        console.log("[BOT_SLOT] Botão refresh clicado.");

        ['.ui-dialog', '.ui-dialog-overlay', '.ui-dialog.ui-draggable', '.ui-dialog-title-load-busy-call-box', '.ui-loading-image', '.ui-load-busy-message']
            .forEach(selector => {
                document.querySelectorAll(selector).forEach(el => el.remove());
            });

        return true;
    }

    async function handleSlotRequest(promptDate, promptHour) {
        if (isReserving || slotFound) return;
        isReserving = true;

        if (!isRunning) return;

        if (!clickRefreshButton()) {
            isReserving = false;
            return;
        }

        await new Promise(r => setTimeout(r, 350));

        const radio = document.querySelector("input[name*='gpFreeSlotDate']:checked");
        if (!radio) {
            console.log("[BOT_SLOT] Nenhum slot disponível.");
            isReserving = false;
            return;
        }

        console.log("[BOT_SLOT] SLOT DISPONÍVEL detectado! Parando todas as tentativas.");
        slotFound = true;
        clearAllTimers();

        const refreshBtn = document.evaluate(REFRESH_BTN_XPATH, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (refreshBtn) refreshBtn.remove();

        const confirmedRadio = document.querySelector("input[name*='gpFreeSlotDate']:checked");
        if (!confirmedRadio) {
            console.error("[BOT_SLOT] Slot sumiu antes da reserva.");
            return;
        }

        const selectedValue = confirmedRadio.value;
        console.log("[BOT_SLOT] Valor selecionado para reserva:", selectedValue);

        const url = buildUrlFromTemplate(RESERVE_URL_TEMPLATE);
        if (!url) {
            console.error("[BOT_SLOT] Não foi possível montar URL de reserva.");
            return;
        }

        reservationAttemptCount++;

        const payload = new URLSearchParams({
            "wicket:ignoreIfNotActive": "true",
            "random": Math.random(),
            "slotAllocationModal:content:rightPanelForm:freeSlotGridPanel:tfDate": promptDate,
            "slotAllocationModal:content:rightPanelForm:freeSlotGridPanel:tfHour": promptHour,
            "slotAllocationModal:content:rightPanelForm:freeSlotGridPanel:gpFreeSlotDate": selectedValue,
            "slotAllocationModal:content:rightPanelForm:actionTaskBar:divBtReserveAction:btReserveActivation": "1"
        }).toString();

        new Wicket.Ajax.Call(
            url,
            () => console.log("[BOT_SLOT] Reserva enviada com sucesso."),
            () => console.error("[BOT_SLOT] Falha ao enviar reserva."),
            "0|s"
        ).post(payload);
    }

    function startRequestCycle(promptDate, promptHour) {
        if (isRunning) {
            console.warn("[BOT_SLOT] Já está rodando. Ignorando nova execução.");
            return;
        }

        if (!latestWicketPrefix) {
            console.warn("[BOT_SLOT] wicketId ainda não capturado. Aguardando...");
            return;
        }

        isRunning = true;
        console.log("[BOT_SLOT] Iniciando ciclo por", EXECUTION_SECONDS, "segundos.");

        let secondsPassed = 0;

        intervalId = setInterval(() => {
            if (!isRunning || slotFound) {
                clearAllTimers();
                return;
            }

            if (secondsPassed >= EXECUTION_SECONDS) {
                console.log("[BOT_SLOT] Tempo limite sem slot. Encerrando.");
                clearAllTimers();
                return;
            }

            secondsPassed++;

            for (let j = 0; j < REQUEST_QUANTITY; j++) {
                const timeoutId = setTimeout(() => {
                    if (isRunning && !slotFound) {
                        handleSlotRequest(promptDate, promptHour);
                    }
                }, REQUEST_TIMEOUT_MILLIS * j);
                timeoutIds.push(timeoutId);
            }
        }, 1000);
    }

    function waitForWicketAndMonitorCalls(callback) {
        const interval = setInterval(() => {
            if (wicketCaptured || isRunning) {
                clearInterval(interval);
                return;
            }

            if (typeof Wicket !== 'undefined' && Wicket?.Ajax?.Call) {
                clearInterval(interval);

                const OriginalCall = Wicket.Ajax.Call;

                Wicket.Ajax.Call = function (url, success, failure, channel) {
                    const call = new OriginalCall(url, success, failure, channel);

                    const originalPost = call.request.post;
                    call.request.post = function (data) {
                        if (!wicketCaptured && typeof data === 'string') {
                            const match = call.request.url.match(/wicket-(\d+):(\d+)/);
                            if (match && match[0]) {
                                latestWicketPrefix = match[0];
                                wicketCaptured = true;
                                console.log("[CAPTURA] Wicket ID capturado:", latestWicketPrefix);
                                if (typeof callback === 'function') callback();
                            }
                        }
                        return originalPost.call(call.request, data);
                    };

                    return call;
                };

                console.info("[BOT_SLOT] Monitor Wicket ativado.");
            }
        }, 200);
    }

    let refreshClickCount = 0;
    let refreshClickListenerSet = false;

    setInterval(() => {
        const refreshBtn = document.evaluate(REFRESH_BTN_XPATH, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

        if (refreshBtn && !refreshClickListenerSet) {
            refreshBtn.addEventListener('click', () => {
                refreshClickCount++;
                console.log(`[BOT_SLOT] Clique detectado (${refreshClickCount})`);

                if (refreshClickCount >= 2 && !isRunning) {
                    const promptDate = prompt("Digite a data do slot (DD/MM/AAAA):", "");
                    const promptHour = prompt("Digite o horário do slot (HH:MM):", "");

                    if (!promptDate || !promptHour) {
                        console.warn("[BOT_SLOT] Data ou hora não fornecida.");
                        refreshClickCount = 0;
                        return;
                    }

                    if (wicketCaptured) {
                        startRequestCycle(promptDate, promptHour);
                    } else {
                        console.log("[BOT_SLOT] Aguardando captura do Wicket ID...");
                        waitForWicketAndMonitorCalls(() => {
                            startRequestCycle(promptDate, promptHour);
                        });
                    }

                    refreshClickCount = 0;
                }
            });

            refreshClickListenerSet = true;
        }
    }, 500);

    waitForWicketAndMonitorCalls();
    console.info('[BOT_SLOT] Script carregado. Clique 2x no botão de refresh para iniciar.');
})();
