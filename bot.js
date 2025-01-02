// ==UserScript==
// @name         BOT_SLOT
// @namespace    http://tampermonkey.net/
// @version      2025-01-02
// @description  try to take over the world!
// @author       Ataide
// @match        https://sigma.decea.mil.br/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let secondsInterval = null;
    let responseCheckInterval = null;
    let hasFoundSlot = false;
    let isRunning = false;
    let canPressConfirmButton = false;
    let isPromptVisible = false;  // Controle de exibição do prompt

    const EXECUTION_SECONDS = 3; // Quantidade de segundos na qual o bot vai tentar achar slots
    const REQUEST_QUANTITY = 4; // Quantidade de requests por segundo
    const REQUEST_TIMEOUT_MILLIS = 300; // Quantidade de millisegundos entre cada request

    const searchButtonXPath = '/html/body/div[1]/div/div[2]/div/div/div/div/div[3]/table/tbody/tr/td[1]/table[1]/tbody/tr[2]/td/table/tbody/tr/td[4]/div/input';
    const reserveButtonXPath = '/html/body/div[1]/div/div[2]/div/div/div/div/div[3]/div[2]/div[1]/input';
    const slotCountXPath = '/html/body/div[1]/div/div[2]/div/div/div/div/div[3]/table/tbody/tr/td[1]/table[1]/tbody/tr[2]/td/div/table/tfoot/tr/td/label';

    const SLOT_TYPE_PROMPT =
        `O BOT DE PEGAR SLOT ESTÁ ATIVO,
        DIGITE O HORÁRIO DESEJADO:

        (AO APERTAR EM CONFIRMAR O BOT VAI RODAR A SUA ROTINA)`;


    const findElementByXPath = (xPath) => {
        return document.evaluate(xPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    };

    const removeElementsByClassName = (className) => {
        document.querySelectorAll(className).forEach(i => i.remove());
    };

    const isResponseValid = () => {
        // Seleciona o elemento pelo XPath fornecido
        const element = findElementByXPath(slotCountXPath);
        if (element) {
            
            const innerHTML = element.innerHTML;
            const cleanedCount = innerHTML.replace('(', '').replace(')', '').trim();
            const count = Number(cleanedCount);

            // Verificar se o valor de count é maior que 1
            if (count == 1) {
                return true;
            } else {
                return false;
            }
        } else {
            console.info("Não encontrou o elemento pelo XPath.");
            return false;
        }
    };

    const stopRoutine = () => {
        // Remover os elementos de diálogo e o botão de pesquisa
        removeElementsByClassName('.ui-dialog');
        removeElementsByClassName('.ui-dialog-overlay');
        isRunning = false;
        clearInterval(secondsInterval);
        clearInterval(responseCheckInterval);

        // Remover o botão de pesquisa ao final da rotina
        const searchButton = findElementByXPath(searchButtonXPath);
        if (searchButton) {
            searchButton.remove();
            console.log("Botão de pesquisa removido, rotina finalizada.");
        }

        console.info("ROTINA FINALIZADA. Você pode realizar uma nova solicitação.");

        // Reexibir o botão de confirmação
        const confirmButton = document.querySelector("#btnInsertSlotUp1504");
        if (confirmButton) {
            confirmButton.disabled = false; // Habilitando o botão de confirmação
        }

        // Resetando variáveis para permitir nova execução
        hasFoundSlot = false;
        isPromptVisible = false;
        canPressConfirmButton = false;
    };

    const startResponseCheckInterval = () => {
        if (isResponseValid()) {
            console.info("Request retornou um slot com sucesso: ");
            if (!hasFoundSlot) {
                console.info("Usando como resultado final o request...");
                hasFoundSlot = true;
                stopRoutine();

                // Selecionar o primeiro SLOT
                // Tentar reservar o SLOT automaticamente
                findElementByXPath(reserveButtonXPath).click();
                canPressConfirmButton = true;
            }
        } else {
            console.info("Não achou nenhum slot :( ");
        }
    };

    const findSlot = ({ buttonElement }) => {
        if (!hasFoundSlot) {
            console.info("Mandando request para achar os slots...");
            buttonElement.click();
            removeElementsByClassName('.ui-dialog');
            removeElementsByClassName('.ui-dialog-overlay');
        }
    };

    const sendRequests = ({ buttonElement, type }) => {
        console.info("BOT_SLOT: Rodando o Bot");

        // Resetar aplicação
        hasFoundSlot = false;
        let i = 0;

        secondsInterval = setInterval(() => {
            if (++i > EXECUTION_SECONDS - 1) {
                stopRoutine();
                return;
            }

            console.log("Executando rotina de slot: " + new Date() + ", segundo: 0" + i);

            for (let j = 0; j < REQUEST_QUANTITY; j++) {
                setTimeout(() => {
                    findSlot({ buttonElement });
                    // Chama a verificação de resposta após cada request
                    startResponseCheckInterval(); // Verificar se há slots disponíveis
                }, REQUEST_TIMEOUT_MILLIS * j);
            }
        }, 1000);

        // Inicialmente, também verifica a disponibilidade de slots ao começar a execução
        startResponseCheckInterval();
    };

    // Intervalo usado para achar o botão de refresh
    setInterval(() => {
        const refreshButton = findElementByXPath(searchButtonXPath);

        if (refreshButton && !isRunning && !isPromptVisible) {
            let slotType = prompt(SLOT_TYPE_PROMPT);

            if (slotType && slotType !== "") {
                console.log(slotType);

                // Exemplo de preenchimento de campo de slot no DOM
                document.querySelector('[name="slotAllocationModal:content:rightPanelForm:freeSlotGridPanel:tfHour"]').value = slotType;

                isRunning = true;
                sendRequests({
                    buttonElement: slotType == '0' ? findElementByXPath(reserveButtonXPath) : refreshButton,
                    type: slotType
                });

                // Marcar que o prompt foi exibido
                isPromptVisible = true;
            }
        }

    }, 100);

    /**
     * Função para esperar o botão de confirmação e clicar nele
     */
    const waitForConfirmButton = () => {
        const confirmButton = document.querySelector("#btnInsertSlotUp1504");

        if (confirmButton && canPressConfirmButton) {
            console.info("Pode apertar: ", canPressConfirmButton);
            confirmButton.click();
            console.log("Clicou no botão de confirmação");

            // Reiniciar o processo após a confirmação do horário escolhido
            setTimeout(() => {
                let slotTime = prompt(SLOT_TYPE_PROMPT);
                if (slotTime && slotTime !== "") {
                    console.log("Horário escolhido:", slotTime);

                    // Inserir o valor do prompt no campo correspondente
                    document.querySelector('[name="slotAllocationModal:content:rightPanelForm:freeSlotGridPanel:tfHour"]').value = slotTime;

                    // Marcar que o prompt foi exibido e reiniciar a rotina
                    isPromptVisible = false;
                    isRunning = false;  // Resetando a execução do bot para permitir nova solicitação
                    canPressConfirmButton = false; // Resetando a variável de confirmação

                    // Reiniciando o fluxo e aguardando novo clique
                    const searchButton = findElementByXPath(searchButtonXPath);
                    if (searchButton) {
                        searchButton.style.display = "inline";  // Exibir novamente o botão
                    }
                }
            }, 100);  // Aguarda um pequeno intervalo antes de mostrar o prompt

            canPressConfirmButton = false;
        }
    };

    setInterval(waitForConfirmButton, 100);

    console.info('BOT_SLOT: Iniciando...');
})();
