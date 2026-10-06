document.addEventListener('DOMContentLoaded', async () => {
    // Toast notification system
    function showToast(message, type = 'error', duration = 5000) {
        // Create toast container if it doesn't exist
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // Add toast content
        toast.innerHTML = `
            <span class="toast-icon">
                <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
            </span>
            <span class="toast-message">${message}</span>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add toast to container
        toastContainer.appendChild(toast);
        
        // Close button functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            removeToast(toast);
        });
        
        // Auto-remove after duration
        setTimeout(() => {
            removeToast(toast);
        }, duration);
        
        // Function to remove toast with animation
        function removeToast(toastElement) {
            toastElement.classList.add('removing');
            setTimeout(() => {
                toastElement.remove();
                
                // Remove container if empty
                if (toastContainer.children.length === 0) {
                    toastContainer.remove();
                }
            }, 300);
        }
        
        return toast;
    }

    const useDefaultAll = document.getElementById('use-default-all');
    const walletInputs = document.querySelectorAll('.wallet-input');
    const globalDefaultBox = document.querySelector('.global-default');
    const saveButton = document.getElementById('save-wallet-config');
    const chainToggles = document.querySelectorAll('.wallet-chain-toggle');
    const currencySelector = document.getElementById('currency-selector');
    const custodyAmountElement = document.getElementById('custody-amount');
    let isConfigured = false;
    let balanceData = {
        USD: 0.00,
        EUR: 0.00
    };

    // Store initial state
    const initialState = {
        useDefaultAll: useDefaultAll.checked,
        chainToggles: Array.from(chainToggles).map(toggle => toggle.checked),
        walletInputs: Array.from(walletInputs).map(input => input.value)
    };

    // Fetch initial configuration from server
    async function getInitialConfig() {
        try {
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('userData'));
            const userId = user ? user.id : null;
            const response = await fetch(`${API_URL}/api/getVendorWalletConfig`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        vendorID: userId,
                    })
                });

            if (!response.ok) {
                throw new Error('Failed to fetch configuration');
            }
            let data = await response.json();
            console.log('Fetched vendor configuration:', data);
            return data;
        }
        catch (error) {
            console.error('Error fetching vendor configuration:', error);
            return null;
        }
    }

    // Apply configuration to UI
    async function applyConfiguration() {
        const config = await getInitialConfig();
        if (!config) return;

        // Apply use default setting
        useDefaultAll.checked = config.useDefaultAll;
        if (config.useDefaultAll) {
            globalDefaultBox.classList.add('active');
        }


        // Store custody amounts if available
        if (config.custodyAmountUSD !== undefined && config.custodyAmountEUR !== undefined) {
            balanceData.USD = parseFloat(config.custodyAmountUSD).toFixed(2);
            balanceData.EUR = parseFloat(config.custodyAmountEUR).toFixed(2);
            
            // Display initial amount based on selected currency
            updateBalanceDisplay();
        }

        // Apply chain toggles and wallet addresses
        chainToggles.forEach((toggle, index) => {
            if (config.chains && config.chains[index]) {
                toggle.checked = config.chains[index].enabled;
                const chain = toggle.closest('.chain');
                const walletInput = chain.querySelector('.wallet-input');
                
                if (walletInput) {
                    walletInput.value = config.chains[index].walletAddress || '';
                    walletInput.disabled = config.useDefaultAll || !config.chains[index].enabled;
                }
                
                if (!config.chains[index].enabled) {
                    chain.classList.add('chain-disabled');
                }
            }
        });

        // Store initial state after configuration is applied
        initialState.useDefaultAll = useDefaultAll.checked;
        initialState.chainToggles = Array.from(chainToggles).map(toggle => toggle.checked);
        initialState.walletInputs = Array.from(walletInputs).map(input => input.value);
        
        isConfigured = true;
    }

    // Function to update balance display based on selected currency
    function updateBalanceDisplay(selectedCurrency = null) {
        if (!custodyAmountElement) return;
        
        // If no currency is provided, get it from the display element
        const currency = selectedCurrency || currencyDisplay.textContent;
        
        if (currency === 'USD') {
            custodyAmountElement.textContent = balanceData.USD;
            custodyAmountElement.setAttribute('data-currency', '$');
        } else {
            custodyAmountElement.textContent = balanceData.EUR;
            custodyAmountElement.setAttribute('data-currency', '€');
        }
    }

    // Add event listener for currency selector
    if (currencySelector) {
        currencySelector.addEventListener('change', updateBalanceDisplay);
    }

    function checkStateChanged() {
        // Create or get error message element
        let errorMsg = document.querySelector('.wallet-error-message');

        // Check if at least one chain is toggled
        const activeChains = Array.from(chainToggles).filter(toggle => toggle.checked);
        if (activeChains.length === 0) {
            errorMsg.textContent = "At least one chain must be used";
            errorMsg.style.display = 'block';
            saveButton.disabled = true;
            return;
        }

        // Check if all active chains have wallet addresses when not using custodial wallet
        if (!useDefaultAll.checked) {
            const missingAddresses = [];
            
            chainToggles.forEach((toggle, index) => {
                if (toggle.checked) {
                    const chain = toggle.closest('.chain');
                    const walletInput = chain.querySelector('.wallet-input');
                    const chainLogoImg = chain.querySelector('.chain-logo');
                    
                    if (!walletInput.value.trim()) {
                        const chainName = chainLogoImg ? chainLogoImg.alt.charAt(0).toUpperCase() + chainLogoImg.alt.slice(1) : `Chain ${index+1}`;
                        missingAddresses.push(chainName);
                    }
                }
            });
            
            if (missingAddresses.length > 0) {
                errorMsg.textContent = `Please enter wallet addresses for: ${missingAddresses.join(', ')}`;
                errorMsg.style.display = 'block';
                saveButton.disabled = true;
                return;
            }
        }

        // If we reach here, there are no validation errors
        errorMsg.style.display = 'none';
        
        // Check if state has changed from initial
        const currentState = {
            useDefaultAll: useDefaultAll.checked,
            chainToggles: Array.from(chainToggles).map(toggle => toggle.checked),
            walletInputs: Array.from(walletInputs).map(input => input.value)
        };

        const hasChanges =
            initialState.useDefaultAll !== currentState.useDefaultAll ||
            JSON.stringify(initialState.chainToggles) !== JSON.stringify(currentState.chainToggles) ||
            JSON.stringify(initialState.walletInputs) !== JSON.stringify(currentState.walletInputs);

        saveButton.disabled = !hasChanges;
    }

    // Address validation functions
    function isValidSolanaAddress(address) {
        // Base58 format, typical length 32-44 chars
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
        return base58Regex.test(address) && address.length >= 32 && address.length <= 44;
    }

    function isValidEthAddress(address) {
        // Ethereum and other EVM chains use 0x followed by 40 hex chars
        const ethRegex = /^0x[a-fA-F0-9]{40}$/;
        return ethRegex.test(address);
    }

    // Initial state setup
    if (useDefaultAll.checked) {
        globalDefaultBox.classList.add('active');
    }

    useDefaultAll.addEventListener('change', (e) => {
        walletInputs.forEach(input => {
            input.disabled = e.target.checked;
            if (e.target.checked) {
                input.value = '';
                const inputGroup = input.closest('.wallet-input-group');
                if (inputGroup) {
                    inputGroup.classList.remove('valid-address');
                }
            }
        });

        if (e.target.checked) {
            globalDefaultBox.classList.add('active');
        } else {
            globalDefaultBox.classList.remove('active');
        }
        
        checkStateChanged();
    });

    document.querySelectorAll('.wallet-chain-toggle').forEach(toggle => {
        toggle.addEventListener('change', function() {
            // Add this check to ensure we're only handling toggles in the Wallets tab
            if (!this.closest('#wallets')) {
                return; // Exit if toggle is not inside the Wallets tab
            }
            
            const walletInput = this.closest('.chain').querySelector('.wallet-input');
            const chain = this.closest('.chain');
            
            if (!this.checked) {
                walletInput.disabled = true;
                chain.classList.add('chain-disabled');
            } else {
                walletInput.disabled = useDefaultAll.checked;
                chain.classList.remove('chain-disabled');
            }
            
            checkStateChanged();
        });
    });

    walletInputs.forEach(input => {
        input.addEventListener('input', function() {
            // Add address validation
            const inputGroup = this.closest('.wallet-input-group');
            const chainType = this.closest('.chain').querySelector('.chain-logo').alt.toLowerCase();
            const value = this.value.trim();
            
            // Remove validation classes
            inputGroup.classList.remove('valid-address');
            
            // Check for valid address based on chain type
            if (value) {
                if (chainType === 'solana' && isValidSolanaAddress(value)) {
                    inputGroup.classList.add('valid-address');
                } 
                else if ((chainType === 'ethereum' || chainType === 'base') && isValidEthAddress(value)) {
                    inputGroup.classList.add('valid-address');
                }
            }
            
            // Call your existing state changed function
            checkStateChanged();
        });
    });

    saveButton.addEventListener('click', async () => {
        try {
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('userData'));
            const userId = user ? user.id : null;

            // Create wallets array
            const wallets = Array.from(chainToggles).map((toggle, index) => {
                const chain = toggle.closest('.chain');
                const chainLogoImg = chain.querySelector('.chain-logo');
    
                // Get chain name from the alt attribute of the logo image
                const chainName = chainLogoImg.alt.toLowerCase() ;

                const walletInput = chain.querySelector('.wallet-input');
                
                return {
                    chain: chainName,
                    address: walletInput.value,
                    active: toggle.checked
                };
            });

            console.log('Saving wallet configuration:', wallets);
            
            const response = await fetch(`${API_URL}/api/setVendorWalletConfig`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        vendorID: userId,
                        isCustodial: useDefaultAll.checked,
                        wallets: wallets,
                    })
                });

            if (!response.ok) {
                throw new Error('Failed to save configuration');
            }
            
            // Update initial state after successful save
            initialState.useDefaultAll = useDefaultAll.checked;
            initialState.chainToggles = Array.from(chainToggles).map(toggle => toggle.checked);
            initialState.walletInputs = Array.from(walletInputs).map(input => input.value);
            
            saveButton.disabled = true;
        } catch (error) {
            console.error('Failed to save wallet configuration:', error);
        }
    });

    // Listen for tab changes
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', async () => {
            if (item.getAttribute('data-tab') === 'wallets' && !isConfigured) {
                await applyConfiguration();
                checkStateChanged();
            }
        });
    });

    // Check if wallets tab is active on initial load
    const walletsTab = document.querySelector('.sidebar-item[data-tab="wallets"]');
    if (walletsTab && walletsTab.classList.contains('active')) {
        await applyConfiguration();
        checkStateChanged();
        setTimeout(handleMobileWalletView, 50);
    }

    // Mobile-specific adjustments
    function handleMobileWalletView() {
        // Rearrange elements for mobile view
        if (window.innerWidth <= 768) {
            // Move global default checkbox after chain selector
            const chainSelector = document.querySelector('.chain-selector');
            const globalDefault = document.querySelector('.global-default');
            const walletLayout = document.querySelector('.wallet-layout');
            
            if (chainSelector && globalDefault && walletLayout) {
                // Only rearrange if not already done
                if (globalDefault.parentElement === walletLayout) {
                    walletLayout.appendChild(globalDefault);
                }
            }
            
            // Adjust error message positioning
            const errorMessage = document.querySelector('.wallet-error-message');
            if (errorMessage) {
                errorMessage.style.position = 'fixed';
                errorMessage.style.bottom = '80px';
                errorMessage.style.left = '50%';
                errorMessage.style.transform = 'translateX(-50%)';
            }
        } else {
            // Reset for desktop if needed
            const errorMessage = document.querySelector('.wallet-error-message');
            if (errorMessage) {
                errorMessage.style.position = '';
                errorMessage.style.bottom = '';
                errorMessage.style.left = '';
                errorMessage.style.transform = '';
            }
        }
    }

    // Call on page load and window resize
    window.addEventListener('resize', handleMobileWalletView);

    // Handle wallets tab activation
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', () => {
            if (item.getAttribute('data-tab') === 'wallets') {
                // Run after a slight delay to ensure DOM is updated
                setTimeout(handleMobileWalletView, 50);
            }
        });
    });

    // Custom dropdown functionality
    const currencyDisplay = document.getElementById('currency-display');
    const dropdownMenu = currencyDisplay?.nextElementSibling;
    const dropdownItems = dropdownMenu?.querySelectorAll('.dropdown-item');

    if (currencyDisplay && dropdownMenu) {
        // Toggle dropdown
        currencyDisplay.addEventListener('click', function() {
            dropdownMenu.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
            if (!event.target.closest('.currency-selector')) {
                dropdownMenu.classList.remove('show');
            }
        });

        // Select currency
        dropdownItems.forEach(item => {
            item.addEventListener('click', function() {
                const value = this.dataset.value;
                currencyDisplay.textContent = value;
                
                // Update active state
                dropdownItems.forEach(el => el.classList.remove('active'));
                this.classList.add('active');
                
                // Close dropdown
                dropdownMenu.classList.remove('show');
                
                // Trigger the currency change
                updateBalanceDisplay(value);
            });
        });
    }

    // Redemption modal functionality
    const redeemBalanceBtn = document.getElementById('redeem-balance');
    const redemptionModal = document.getElementById('redemption-modal');
    const closeModalBtn = redemptionModal?.querySelector('.modal-close-btn');
    const stepPanels = redemptionModal?.querySelectorAll('.redeem-step-panel');
    const stepIndicators = redemptionModal?.querySelectorAll('.redemption-stepper .step');
    const nextBtn = redemptionModal?.querySelector('.next-btn');
    const prevBtn = redemptionModal?.querySelector('.prev-btn');
    const withdrawBtn = redemptionModal?.querySelector('.withdraw-btn');
    const redeemUsdtBalanceEl = document.getElementById('redeem-usdt-balance');
    const redeemUsdcBalanceEl = document.getElementById('redeem-usdc-balance');
    const redeemEurcBalanceEl = document.getElementById('redeem-eurc-balance');
    const withdrawalAmountInput = document.getElementById('withdrawal-amount');
    const availableBalanceDisplay = document.getElementById('available-balance-display');
    const amountCurrencySymbol = document.getElementById('amount-currency-symbol');
    const quickAmountBtns = document.querySelectorAll('.quick-amount-btn');
    const withdrawalAddressContainer = document.getElementById('withdrawal-address-container');
    const withdrawalAddressInput = document.getElementById('withdrawal-address');
    let currentStep = 1;
    let selectedCoin = 'USDT';
    let selectedCurrency = 'USD';
    let selectedMethod = 'solana';

    function updateCoinMethodAvailability() {
        const baseMethod = document.getElementById('withdraw-base');
        const baseMethodContainer = baseMethod?.closest('.withdrawal-method');
        if (!baseMethod) return;

        baseMethod.disabled = selectedCoin === 'USDT';
        baseMethodContainer?.classList.toggle('disabled', baseMethod.disabled);
        if (baseMethod.disabled && baseMethod.checked) {
            document.getElementById('withdraw-solana').checked = true;
            selectedMethod = 'solana';
        }
    }

    if (withdrawalAddressInput) {
        withdrawalAddressInput.addEventListener('input', function() {
            // Get the selected withdrawal method
            const selectedMethod = document.querySelector('input[name="withdraw-method"]:checked').value;
            const addressContainer = this.closest('#withdrawal-address-container');
            
            // Remove any existing error message
            const existingError = addressContainer.querySelector('.withdrawal-address-error');
            if (existingError) existingError.remove();
            
            // Remove existing validation classes
            addressContainer.classList.remove('valid-address', 'invalid-address');
            
            const value = this.value.trim();
            
            if (!value) return; // Skip validation if empty
            
            // Validate based on selected method
            let isValid = false;
            let errorMessage = '';
            
            if (selectedMethod === 'solana') {
                isValid = isValidSolanaAddress(value);
                if (!isValid) errorMessage = 'Please enter a valid Solana wallet address.';
            } else if (selectedMethod === 'base') {
                isValid = isValidEthAddress(value);
                if (!isValid) errorMessage = 'Please enter a valid Base wallet address.';
            }
            
            // Add appropriate class based on validation
            if (isValid) {
                addressContainer.classList.add('valid-address');
            } else {
                addressContainer.classList.add('invalid-address');
                
                // Add error message if invalid
                if (errorMessage) {
                    const errorEl = document.createElement('div');
                    errorEl.className = 'withdrawal-address-error';
                    errorEl.textContent = errorMessage;
                    addressContainer.appendChild(errorEl);
                }
            }
        });
    }

    if (redeemBalanceBtn && redemptionModal) {
        // Update balance display in the redemption modal
        function updateRedemptionBalances() {
            if (redeemUsdtBalanceEl) redeemUsdtBalanceEl.textContent = balanceData.USD;
            if (redeemUsdcBalanceEl) redeemUsdcBalanceEl.textContent = balanceData.USD;
            if (redeemEurcBalanceEl) redeemEurcBalanceEl.textContent = balanceData.EUR;
        }
        
        // Open modal
        redeemBalanceBtn.addEventListener('click', () => {
            updateRedemptionBalances();
            updateCoinMethodAvailability();
            redemptionModal.classList.add('show');
            document.body.style.overflow = 'hidden'; // Prevent scrolling
            
            // Reset to first step
            goToStep(1);
            
            // Set initial available balance
            updateAvailableBalance();
        });
        
        // Close modal
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                redemptionModal.classList.remove('show');
                document.body.style.overflow = '';
            });
        }
        
        // Outside click to close
        redemptionModal.addEventListener('click', (e) => {
            if (e.target === redemptionModal) {
                redemptionModal.classList.remove('show');
                document.body.style.overflow = '';
            }
        });
        
        // Navigation between steps
        function goToStep(step) {
            if (step < 1 || step > 4) return;
            
            currentStep = step;
            
            // Update step panels
            stepPanels.forEach(panel => {
                panel.classList.remove('active');
            });
            
            const activePanel = document.querySelector(`.redeem-step-panel[data-step="${step}"]`);
            if (activePanel) activePanel.classList.add('active');
            
            // Update step indicators
            stepIndicators.forEach((indicator, index) => {
                indicator.classList.remove('active', 'completed');
                
                if (index + 1 === currentStep) {
                    indicator.classList.add('active');
                } else if (index + 1 < currentStep) {
                    indicator.classList.add('completed');
                }
            });
            
            // Update navigation buttons based on step
            prevBtn.disabled = currentStep === 1;
            
            if (currentStep === 3) {
                nextBtn.style.display = 'none';
                withdrawBtn.style.display = 'block';
            } else if (currentStep === 4) {
                // For success step, hide both next and withdraw buttons
                nextBtn.style.display = 'none';
                withdrawBtn.style.display = 'none';
                prevBtn.style.display = 'none';
            } else {
                nextBtn.style.display = 'block';
                withdrawBtn.style.display = 'none';
                prevBtn.style.display = 'block';
            }
        }
        
        // Event listeners for navigation
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (currentStep === 1) {
                    // Get selected coin and its balance denomination
                    const coinRadio = document.querySelector('input[name="redeem-coin"]:checked');
                    if (coinRadio) {
                        selectedCoin = coinRadio.value;
                        selectedCurrency = selectedCoin === 'EURC' ? 'EUR' : 'USD';
                        updateAvailableBalance();
                    }
                } else if (currentStep === 2) {
                    // Get selected withdrawal method
                    const methodRadio = document.querySelector('input[name="withdraw-method"]:checked');
                    if (methodRadio) {
                        selectedMethod = methodRadio.value;
                    }
                }
                
                goToStep(currentStep + 1);
            });
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                goToStep(currentStep - 1);
            });
        }
        
        // Update available balance display
        function updateAvailableBalance() {
            if (!availableBalanceDisplay) return;
            
            const balance = selectedCurrency === 'USD' ? balanceData.USD : balanceData.EUR;
            const symbol = selectedCurrency === 'USD' ? '$' : '€';
            
            availableBalanceDisplay.textContent = `${symbol}${balance}`;
            
            if (amountCurrencySymbol) {
                amountCurrencySymbol.textContent = symbol;
            }
            
            // Set max withdrawal amount
            if (withdrawalAmountInput) {
                withdrawalAmountInput.max = balance;
                withdrawalAmountInput.value = '0.00';
            }
        }
        
        // Coin selection
        document.querySelectorAll('input[name="redeem-coin"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                selectedCoin = e.target.value;
                selectedCurrency = selectedCoin === 'EURC' ? 'EUR' : 'USD';
                updateCoinMethodAvailability();
                updateAvailableBalance();
            });
        });
        
        // Withdrawal method selection - set appropriate placeholder for wallet address
        document.querySelectorAll('input[name="withdraw-method"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                selectedMethod = e.target.value;
                
                // Update wallet address placeholder
                if (withdrawalAddressInput) {
                    if (selectedMethod === 'solana') {
                        withdrawalAddressInput.placeholder = "Enter Solana wallet address";
                    } else if (selectedMethod === 'base') {
                        withdrawalAddressInput.placeholder = "Enter Base wallet address";
                    }
                }
                
                // Toggle visibility of withdrawal notes based on selected method
                const blockchainNote = document.getElementById('blockchain-withdrawal-note');
                const bankNote = document.getElementById('bank-withdrawal-note');
                
                if (blockchainNote && bankNote) {
                    if (selectedMethod === 'solana' || selectedMethod === 'base') {
                        blockchainNote.style.display = 'block';
                        bankNote.style.display = 'none';
                    } else {
                        blockchainNote.style.display = 'none';
                        bankNote.style.display = 'block';
                    }
                }

                // Also trigger validation for existing address value
                if (withdrawalAddressInput && withdrawalAddressInput.value.trim()) {
                    // Trigger the input event to validate with the new method
                    withdrawalAddressInput.dispatchEvent(new Event('input'));
                }
            });
        });
        
        // Quick amount buttons
        if (quickAmountBtns.length > 0) {
            quickAmountBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const percent = parseInt(btn.dataset.percent, 10);
                    if (!isNaN(percent) && withdrawalAmountInput) {
                        const balance = parseFloat(selectedCurrency === 'USD' ? balanceData.USD : balanceData.EUR);
                        const amount = (balance * percent / 100).toFixed(2);
                        withdrawalAmountInput.value = amount;
                    }
                });
            });
        }
        
        // Update the withdrawal submission handler to include address validation
        if (withdrawBtn) {
            withdrawBtn.addEventListener('click', async () => {
                // Skip validation if already loading
                if (withdrawBtn.classList.contains('loading')) return;

                const amount = parseFloat(withdrawalAmountInput.value);
                const balance = parseFloat(selectedCurrency === 'USD' ? balanceData.USD : balanceData.EUR);
                const address = withdrawalAddressInput ? withdrawalAddressInput.value.trim() : "";
                const addressContainer = document.getElementById('withdrawal-address-container');
                
                // Remove any existing error messages
                const existingErrors = document.querySelectorAll('.withdrawal-error');
                existingErrors.forEach(error => error.remove());
                
                // Validate amount
                if (isNaN(amount) || amount <= 0) {
                    const errorEl = document.createElement('div');
                    errorEl.className = 'withdrawal-error';
                    errorEl.textContent = 'Please enter a valid amount.';
                    withdrawalAmountInput.parentNode.appendChild(errorEl);
                    return;
                }
                
                if (amount > balance) {
                    const errorEl = document.createElement('div');
                    errorEl.className = 'withdrawal-error';
                    errorEl.textContent = 'Withdrawal amount exceeds available balance.';
                    withdrawalAmountInput.parentNode.appendChild(errorEl);
                    return;
                }
                
                // Validate address
                if (!address) {
                    const errorEl = document.createElement('div');
                    errorEl.className = 'withdrawal-error';
                    errorEl.textContent = 'Please enter a valid wallet address.';
                    addressContainer.appendChild(errorEl);
                    return;
                }
                
                // Validate wallet address format based on selected method
                let isValidAddress = false;
                if (selectedMethod === 'solana') {
                    isValidAddress = isValidSolanaAddress(address);
                    if (!isValidAddress) {
                        const errorEl = document.createElement('div');
                        errorEl.className = 'withdrawal-error';
                        errorEl.textContent = 'Please enter a valid Solana wallet address.';
                        addressContainer.appendChild(errorEl);
                        return;
                    }
                } else if (selectedMethod === 'base') {
                    isValidAddress = isValidEthAddress(address);
                    if (!isValidAddress) {
                        const errorEl = document.createElement('div');
                        errorEl.className = 'withdrawal-error';
                        errorEl.textContent = 'Please enter a valid Base wallet address.';
                        addressContainer.appendChild(errorEl);
                        return;
                    }
                }
                
                // Set button to loading state
                withdrawBtn.classList.add('loading');
                withdrawBtn.disabled = true;
                const originalText = withdrawBtn.textContent;
                withdrawBtn.innerHTML = '<span class="spinner"></span> Processing...';
                
                try {
                    // Get user ID from localStorage
                    const user = JSON.parse(localStorage.getItem('userData'));
                    const token = localStorage.getItem('token');
                    const userId = user ? user.id : null;

                    if (!userId) {
                        throw new Error('User ID not found. Please log in again.');
                    }

                    // Create payload for API
                    const payload = {
                        vendorID: userId,
                        amount: amount,
                        currency: selectedCurrency,
                        paymentDetails: {
                            method: selectedMethod,
                            coin: selectedCoin,
                            destination: address
                        }
                    };

                    // Call the API to redeem balance
                    const response = await fetch(`${API_URL}/api/redeemCustodialBalance`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });

                    const result = await response.json();

                    if (!response.ok) {
                        throw new Error(result.error || 'Failed to process withdrawal');
                    }

                    // Update the balance with the new value from API response
                    if (selectedCurrency === 'USD') {
                        balanceData.USD -= amount;
                    } else {
                        balanceData.EUR -= amount;
                    }

                    // Reset button state after success
                    withdrawBtn.classList.remove('loading');
                    withdrawBtn.disabled = false;
                    withdrawBtn.innerHTML = originalText;
                                        

                    // Instead of alert, populate the success panel and go to step 4
                    document.getElementById('withdrawal-success-message').textContent = result.message;
                    document.getElementById('withdrawal-request-id').textContent = result.redemptionDetails.transactionId;
                    document.getElementById('withdrawal-amount-value').textContent = `${selectedCurrency === 'USD' ? '$' : '€'}${amount.toFixed(2)}`;
                    document.getElementById('withdrawal-destination').textContent = address;
                    document.getElementById('withdrawal-new-balance').textContent = `${selectedCurrency === 'USD' ? `$${balanceData.USD}` : `€${balanceData.EUR}`}`;
                    
                    // Move to success step
                    goToStep(4);
                    

                    // Update the UI
                    updateBalanceDisplay();
                    
                } catch (error) {
                    console.error('Withdrawal failed:', error);
                    showToast(`Failed to process withdrawal: ${error.message}`, 'error');
                    
                    // Reset button state on error
                    withdrawBtn.classList.remove('loading');
                    withdrawBtn.disabled = false;
                    withdrawBtn.textContent = originalText;
                }
            });
        }

        // Add event handler for the "Done" button
        document.getElementById('withdrawal-done-btn')?.addEventListener('click', () => {
            // Close the modal
            redemptionModal.classList.remove('show');
            document.body.style.overflow = '';
        });
    }
});