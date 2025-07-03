// ==UserScript==
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @name         BOT de Slot - API
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatiza alocação de slots 
// @author       Ataide 
// @match        https://sigma.decea.mil.br/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let isRunning = false;
    let latestWicketPrefix = null;
    let prefixCaptured = false;

    const EXECUTION_SECONDS = 3;
    const REQUEST_QUANTITY = 4;
    const REQUEST_TIMEOUT_MILLIS = 350;
    const REFRESH_BTN_XPATH = '/html/body/div[1]/div/div[2]/div/div/div/div/div[3]/table/tbody/tr/td[1]/table[1]/tbody/tr[2]/td/table/tbody/tr/td[4]/div/input';

    const SEARCH_URL_TEMPLATE = "https://sigma.decea.mil.br/slot/?wicket:interface={{wicketId}}:main:contentPanel:searchPanel:formSearch:slotAllocationModal:content:rightPanelForm:freeSlotGridPanel:btSearchGrid::IActivePageBehaviorListener:2:-1";
    const RESERVE_URL_TEMPLATE = "https://sigma.decea.mil.br/slot/?wicket:interface={{wicketId}}:main:contentPanel:searchPanel:formSearch:slotAllocationModal:content:rightPanelForm:actionTaskBar:divBtReserveAction:btReserveActivation::IActivePageBehaviorListener:2:-1";

    const clearPopups = () => {
        ['.ui-dialog', '.ui-dialog-overlay', '.ui-dialog.ui-draggable', '.ui-dialog-title-load-busy-call-box', '.ui-loading-image', '.ui-load-busy-message']
            .forEach(className => document.querySelectorAll(className).forEach(el => el.remove()));
    };

    const buildUrlFromTemplate = (template) => {
        if (!latestWicketPrefix) return null;
        return template.replace("{{wicketId}}", latestWicketPrefix);
    };

    const sendRefreshAjax = (promptDate, promptHour) => {
        const url = buildUrlFromTemplate(SEARCH_URL_TEMPLATE);
        if (!url) {
            console.error("[BOT_SLOT] Não foi possível construir a URL de busca.");
            return;
        }

        const payload = new URLSearchParams({
            "wicket:ignoreIfNotActive": "true",
            "random": Math.random(),
            "slotAllocationModal:content:rightPanelForm:freeSlotGridPanel:tfDate": promptDate,
            "slotAllocationModal:content:rightPanelForm:freeSlotGridPanel:tfHour": promptHour,
            "slotAllocationModal:content:rightPanelForm:freeSlotGridPanel:btSearchGrid": "1"
        }).toString();

        new Wicket.Ajax.Call(
            url,
            () => console.log("[BOT_SLOT] Sucesso no Ajax de refresh."),
            () => console.error("[BOT_SLOT] Falha na requisição Ajax de refresh."),
            "0|s"
        ).post(payload);
    };

    const handleSlotRequest = async ({ clearAllRequests, promptDate, promptHour, hasReservedRef }) => {
        if (hasReservedRef.value) return;

        clearPopups();
        sendRefreshAjax(promptDate, promptHour);

        await new Promise(resolve => setTimeout(resolve, 300));

        clearPopups();

        if (hasReservedRef.value) return;

        const updatedRadio = document.querySelector("input[name*='gpFreeSlotDate']:checked");

        if (!updatedRadio || hasReservedRef.value) {
            console.info("[BOT_SLOT] Nenhum slot disponível ou reserva já feita.");
            return;
        }

        const selectedValue = updatedRadio.value;
        console.log("[DEBUG] Valor selecionado para gpFreeSlotDate:", selectedValue);

        if (hasReservedRef.value) return;

        const url = buildUrlFromTemplate(RESERVE_URL_TEMPLATE);
        if (!url) {
            console.error("[BOT_SLOT] Não foi possível construir a URL de reserva.");
            return;
        }

        const reservePayload = new URLSearchParams({
            "wicket:ignoreIfNotActive": "true",
            "random": Math.random(),
            "slotAllocationModal:content:rightPanelForm:freeSlotGridPanel:tfDate": promptDate,
            "slotAllocationModal:content:rightPanelForm:freeSlotGridPanel:tfHour": promptHour,
            "slotAllocationModal:content:rightPanelForm:freeSlotGridPanel:gpFreeSlotDate": selectedValue,
            "slotAllocationModal:content:rightPanelForm:actionTaskBar:divBtReserveAction:btReserveActivation": "1"
        }).toString();

        if (hasReservedRef.value) return;

        new Wicket.Ajax.Call(
            url,
            () => {
                if (!hasReservedRef.value) {
                    console.log("[BOT_SLOT] Reserva enviada com sucesso.");
                    hasReservedRef.value = true;
                    clearAllRequests();
                }
            },
            () => console.error("[BOT_SLOT] Falha ao enviar reserva."),
            "0|s"
        ).post(reservePayload);
    };

    const sendRequests = ({ promptDate, promptHour }) => {
        console.info("[BOT_SLOT] Rodando o bot");

        isRunning = true;
        let i = 0;
        const hasReservedRef = { value: false };
        const timeouts = [];

        const clearAllRequests = () => {
            isRunning = false;
            clearInterval(secondsInterval);
            timeouts.forEach(id => clearTimeout(id));
            timeouts.length = 0;
        };

        const secondsInterval = setInterval(() => {
            if (i >= EXECUTION_SECONDS || hasReservedRef.value) {
                clearAllRequests();
                return;
            }

            i++;
            console.log(`[BOT_SLOT] Executando rotina de slot: ${new Date().toLocaleTimeString()}, segundo: 0${i}`);

            for (let j = 0; j < REQUEST_QUANTITY; j++) {
                const id = setTimeout(() => {
                    handleSlotRequest({ clearAllRequests, promptDate, promptHour, hasReservedRef });
                }, REQUEST_TIMEOUT_MILLIS * j);
                timeouts.push(id);
            }
        }, 1000);
    };

    let refreshClickCount = 0;
    let refreshClickListenerSet = false;

    setInterval(() => {
        const refreshBtn = document.evaluate(REFRESH_BTN_XPATH, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (refreshBtn && !refreshClickListenerSet) {
            refreshBtn.addEventListener('click', () => {
                refreshClickCount++;

                if (refreshClickCount >= 2 && !isRunning) {
                    const promptDate = prompt("Digite a data do slot (DD/MM/AAAA):", "");
                    const promptHour = prompt("Digite o horário do slot (HH:MM):", "");

                    if (!promptDate || !promptHour) {
                        console.warn("⚠️ Data ou hora não fornecida. Bot cancelado.");
                        refreshClickCount = 0;
                        return;
                    }

                    sendRequests({ promptDate, promptHour });
                    refreshClickCount = 0;
                }
            });
            refreshClickListenerSet = true;
        }
    }, 500);

    function waitForWicketAndMonitorCalls() {
        const interval = setInterval(() => {
            if (typeof Wicket !== 'undefined' && Wicket?.Ajax?.Call) {
                clearInterval(interval);

                const OriginalCall = Wicket.Ajax.Call;

                Wicket.Ajax.Call = function (url, success, failure, channel) {
                    const call = new OriginalCall(url, success, failure, channel);

                    const originalPost = call.request.post;
                    call.request.post = function (data) {
                        if (!prefixCaptured && typeof data === 'string') {
                            const match = call.request.url.match(/wicket-(\d+):(\d+)/);
                            if (match && match[0]) {
                                latestWicketPrefix = match[0];
                                prefixCaptured = true;
                                console.log("[CAPTURA] Prefixo wicket ID dinâmico:", latestWicketPrefix);
                            }
                        }
                        return originalPost.call(call.request, data);
                    };

                    return call;
                };

                console.info("[BOT_SLOT] Monitor de chamadas Wicket.Ajax ativado.");
            }
        }, 200);
    }

    waitForWicketAndMonitorCalls();
    console.info('[BOT_SLOT] Iniciado e aguardando clique no botão de refresh.');
})();