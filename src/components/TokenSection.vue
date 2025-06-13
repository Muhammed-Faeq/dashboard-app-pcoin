<template>
	<div class="admin-dashboard">
		<h2>Token Conversion Admin Panel</h2>

		<!-- Connection Status -->
		<div class="connection-status" :class="{ connected: isConnected }">
			<p v-if="!isConnected">❌ Not connected to wallet</p>
			<p v-else>✅ Connected: {{ connectedAccount }}</p>
			<button v-if="!isConnected" @click="connectWallet" class="connect-btn">
				Connect MetaMask
			</button>
		</div>

		<!-- Contract Info -->
		<div class="contract-info" v-if="isConnected">
			<h3>Contract Information</h3>
			<p><strong>Contract Address:</strong> {{ contractAddress }}</p>
			<p><strong>Network:</strong> Sepolia Testnet</p>
			<p><strong>Total Supply:</strong> {{ totalSupply }} PCOIN</p>
			<p><strong>Contract Owner:</strong> {{ contractOwner }}</p>
			<p><strong>Connected Account:</strong> {{ connectedAccount }}</p>
			<p><strong>Is Owner:</strong> {{ isOwner ? '✅ Yes' : '❌ No' }}</p>
		</div>

		<!-- Owner Warning -->
		<div v-if="isConnected && !isOwner" class="owner-warning">
			⚠️ <strong>Warning:</strong> You are not the contract owner. Only the owner can perform token conversions.
		</div>

		<!-- Users Data -->
		<div class="users-section">
			<h3>Users with UserBalance ({{ users.length }} users)</h3>
			<div class="users-list" v-if="users.length > 0">
				<div v-for="user in users" :key="user.id" class="user-item">
					<span>{{ user.Username || 'Unknown' }} ({{ user.Email || 'No email' }})</span>
					<span>Wallet: {{ user.walletAddress || 'Not provided' }}</span>
					<span>UserBalance: {{ user.UserBalance || 0 }}</span>
					<span :class="getConversionStatusClass(user)">
						{{ user.converted ? 'Converted ✅' : 'Pending 🔄' }}
					</span>
				</div>
			</div>
			<div v-else class="no-users">
				<p>No users found. Click "Refresh User Data" to load users from Firebase.</p>
			</div>
		</div>

		<!-- Conversion Summary -->
		<div class="conversion-summary" v-if="usersToConvert.length > 0">
			<h3>Conversion Summary</h3>
			<p><strong>Users to Convert:</strong> {{ usersToConvert.length }}</p>
			<p><strong>Total Tokens to Mint:</strong> {{ totalTokensToMint }} PCOIN</p>
		</div>

		<!-- Conversion Actions -->
		<div class="conversion-actions" v-if="isConnected">
			<h3>Conversion Actions</h3>

			<div class="action-buttons">
				<button @click="convertAllUsers" :disabled="loading || !hasUsersToConvert || !isOwner"
					class="convert-all-btn">
					{{ loading ? 'Converting...' : `Convert All Users (${usersToConvert.length})` }}
				</button>

				<button @click="refreshUserData" class="refresh-btn" :disabled="loading">
					{{ loading ? 'Loading...' : 'Refresh User Data' }}
				</button>

				<button @click="checkConversionStatus" class="check-status-btn" :disabled="loading">
					Check Conversion Status
				</button>

				<button @click="testSingleConversion" class="test-btn"
					:disabled="loading || !hasUsersToConvert || !isOwner">
					Test Single Conversion
				</button>
			</div>
		</div>

		<!-- Transaction History -->
		<div class="transaction-history" v-if="transactions.length > 0">
			<h3>Recent Transactions</h3>
			<div class="transaction-list">
				<div v-for="tx in transactions" :key="tx.hash" class="transaction-item">
					<span>{{ tx.type }}</span>
					<span>{{ tx.users }} users</span>
					<span>{{ tx.tokens }} tokens</span>
					<span :class="'status-' + tx.status">{{ tx.status }}</span>
					<a :href="getEtherscanUrl(tx.hash)" target="_blank" rel="noopener noreferrer">
						View on Etherscan
					</a>
				</div>
			</div>
		</div>

		<!-- Status Messages -->
		<div class="status-messages">
			<div v-for="message in statusMessages" :key="message.id" :class="['status-message', message.type]">
				{{ message.text }}
			</div>
		</div>
	</div>
</template>

<script>
// Import Firebase functions
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

// Contract ABI - Updated to match your fixed contract
import { CONTRACT_ABI } from '../services/contractABI';

export default {
	name: 'AdminDashboard',
	data() {
		return {
			// Web3 and Contract
			web3: null,
			contract: null,
			contractAddress: '0x7f85b9cdece1c6f315c0601f323d5b19876e92af', // Update this with your deployed contract address

			// Connection State
			isConnected: false,
			connectedAccount: '',
			contractOwner: '',
			isOwner: false,

			// Users Data
			users: [],

			// UI State
			loading: false,
			statusMessages: [],
			transactions: [],
			totalSupply: '0',

			// Firebase
			db: null,
			app: null
		};
	},

	computed: {
		usersToConvert() {
			// Only users with a valid wallet address, positive balance, and not converted
			return this.users.filter(user =>
				user.walletAddress &&
				this.web3 && this.web3.utils.isAddress(user.walletAddress) &&
				user.UserBalance > 0 &&
				!user.converted
			);
		},
		hasUsersToConvert() {
			return this.usersToConvert.length > 0;
		},
		totalTokensToMint() {
			return this.usersToConvert.reduce((total, user) => {
				return total + (parseInt(user.UserBalance) || 0);
			}, 0);
		}
	},

	async mounted() {
		await this.initializeFirebase();
		await this.loadUsers();

		// Check if MetaMask is already connected
		if (typeof window !== 'undefined' && window.ethereum) {
			try {
				const accounts = await window.ethereum.request({ method: 'eth_accounts' });
				if (accounts.length > 0) {
					await this.connectWallet();
				}
			} catch (error) {
				console.error('Error checking existing connection:', error);
			}
		}
	},

	methods: {
		async initializeFirebase() {
			try {
				const firebaseConfig = {
					apiKey: 'AIzaSyCgbBaKZJzUItNfBQbV3Qc9qxtDSlBNEgE',
					appId: '1:454441277105:web:0a1018348446199ff1b490',
					messagingSenderId: '454441277105',
					projectId: 'pcoin-bad70',
					authDomain: 'pcoin-bad70.firebaseapp.com',
					storageBucket: 'pcoin-bad70.firebasestorage.app',
				};

				this.app = initializeApp(firebaseConfig);
				this.db = getFirestore(this.app);
				console.log('Firebase initialized successfully');
			} catch (error) {
				console.error('Firebase initialization error:', error);
				this.addStatusMessage('Firebase initialization failed', 'error');
			}
		},

		async loadUsers() {
			this.loading = true;
			try {
				if (!this.db) {
					throw new Error('Firebase not initialized');
				}

				const usersCollection = collection(this.db, 'Users');
				const userSnapshot = await getDocs(usersCollection);

				this.users = userSnapshot.docs.map(doc => ({
					id: doc.id,
					...doc.data(),
					converted: false // Will be updated when checking blockchain
				}));

				console.log('Loaded users:', this.users);
				this.addStatusMessage(`Loaded ${this.users.length} users from Firebase`, 'success');
			} catch (error) {
				console.error('Error loading users:', error);
				this.addStatusMessage(`Error loading users: ${error.message}`, 'error');
			} finally {
				this.loading = false;
			}
		},

		async connectWallet() {
			try {
				if (typeof window === 'undefined' || !window.ethereum) {
					throw new Error('MetaMask not installed. Please install MetaMask to continue.');
				}

				// Request account access
				const accounts = await window.ethereum.request({
					method: 'eth_requestAccounts',
				});

				if (accounts.length === 0) {
					throw new Error('No accounts found. Please connect your MetaMask wallet.');
				}

				// Initialize Web3 with a more reliable approach
				if (typeof window.Web3 !== 'undefined') {
					this.web3 = new window.Web3(window.ethereum);
				} else {
					// Fallback: try to import Web3
					const Web3 = (await import('web3')).default;
					this.web3 = new Web3(window.ethereum);
				}

				// Check if we're on Sepolia testnet
				const chainId = await this.web3.eth.getChainId();
				console.log('Current chain ID:', chainId);

				if (Number(chainId) !== 11155111) { // Sepolia chain ID
					await this.switchToSepolia();
				}

				this.connectedAccount = accounts[0].toLowerCase();
				this.isConnected = true;

				// Initialize contract
				this.contract = new this.web3.eth.Contract(CONTRACT_ABI, this.contractAddress);
				console.log('Contract initialized:', this.contract);

				// Load contract data
				await this.loadContractData();

				this.addStatusMessage('Connected to MetaMask successfully', 'success');
			} catch (error) {
				console.error('Error connecting wallet:', error);
				this.addStatusMessage(`Connection error: ${error.message}`, 'error');
			}
		},

		async switchToSepolia() {
			try {
				await window.ethereum.request({
					method: 'wallet_switchEthereumChain',
					params: [{ chainId: '0xaa36a7' }], // Sepolia chain ID in hex
				});
			} catch (switchError) {
				console.error('Switch network error:', switchError);
				// Chain not added to MetaMask
				if (switchError.code === 4902) {
					try {
						await window.ethereum.request({
							method: 'wallet_addEthereumChain',
							params: [{
								chainId: '0xaa36a7',
								chainName: 'Sepolia Test Network',
								nativeCurrency: {
									name: 'SepoliaETH',
									symbol: 'SEP',
									decimals: 18,
								},
								rpcUrls: ['https://sepolia.infura.io/v3/'],
								blockExplorerUrls: ['https://sepolia.etherscan.io/'],
							}],
						});
					} catch (addError) {
						console.error('Add network error:', addError);
						throw new Error('Failed to add Sepolia network to MetaMask');
					}
				} else {
					throw new Error('Failed to switch to Sepolia network');
				}
			}
		},

		async loadContractData() {
			try {
				if (!this.contract) {
					throw new Error('Contract not initialized');
				}

				// Load contract owner
				this.contractOwner = await this.contract.methods.owner().call();
				this.contractOwner = this.contractOwner.toLowerCase();
				this.isOwner = this.contractOwner === this.connectedAccount;

				// Load total supply
				const totalSupply = await this.contract.methods.totalSupply().call();
				this.totalSupply = this.web3.utils.fromWei(totalSupply, 'ether');
				console.log('Total supply loaded:', this.totalSupply);

				// Check conversion status for all users
				await this.checkConversionStatus();

				console.log('Contract data loaded successfully');
			} catch (error) {
				console.error('Error loading contract data:', error);
				this.addStatusMessage(`Error loading contract data: ${error.message}`, 'error');
			}
		},

		async checkConversionStatus() {
			if (!this.contract) return;

			try {
				console.log('Checking conversion status for users...');
				for (let user of this.users) {
					if (user.walletAddress && this.web3.utils.isAddress(user.walletAddress)) {
						try {
							const isConverted = await this.contract.methods
								.getConversionStatus(user.walletAddress)
								.call();
							user.converted = isConverted;
							console.log(`User ${user.walletAddress}: ${isConverted ? 'Converted' : 'Not converted'}`);
						} catch (error) {
							console.error(`Error checking status for ${user.walletAddress}:`, error);
						}
					}
				}
				this.addStatusMessage('Conversion status updated', 'success');
			} catch (error) {
				console.error('Error checking conversion status:', error);
				this.addStatusMessage('Error checking conversion status', 'error');
			}
		},

async convertAllUsers() {
	if (!this.contract || this.usersToConvert.length === 0) {
		this.addStatusMessage('No users to convert or contract not initialized', 'error');
		return;
	}

	if (!this.isOwner) {
		this.addStatusMessage('Only the contract owner can perform conversions', 'error');
		return;
	}

	this.loading = true;

	try {
		const addresses = this.usersToConvert.map(user => user.walletAddress);
		// Convert to BigInt explicitly
		const userBalances = this.usersToConvert.map(user => 
			BigInt(parseInt(user.UserBalance) || 0)
		);

		if (addresses.length === 0) {
			this.addStatusMessage('No valid wallet addresses found among users.', 'error');
			this.loading = false;
			return;
		}

		console.log('Converting users:', { addresses, userBalances: userBalances.map(b => b.toString()) });

		this.addStatusMessage(`Starting batch conversion for ${addresses.length} users...`, 'info');

		// Estimate gas first
		const gasEstimate = await this.contract.methods
			.batchConvertPointsToTokens(addresses, userBalances)
			.estimateGas({ from: this.connectedAccount });

		console.log('Gas estimate:', gasEstimate);

		// Send transaction with proper gas limit
		const tx = await this.contract.methods
			.batchConvertPointsToTokens(addresses, userBalances)
			.send({
				from: this.connectedAccount,
				gas: Math.floor(Number(gasEstimate) * 1.2) // Convert BigInt to Number for calculation
			});

		console.log('Transaction successful:', tx);

		// Add to transaction history
		this.transactions.unshift({
			hash: tx.transactionHash,
			type: 'Batch Conversion',
			users: addresses.length,
			tokens: this.totalTokensToMint,
			status: 'success',
			timestamp: new Date()
		});

		this.addStatusMessage('Batch conversion successful!', 'success');

		// Refresh data
		await this.loadContractData();
	} catch (error) {
		console.error('Batch conversion error:', error);
		this.addStatusMessage(`Conversion error: ${error.message}`, 'error');

		// Add failed transaction to history
		this.transactions.unshift({
			hash: 'Failed',
			type: 'Batch Conversion',
			users: this.usersToConvert.length,
			tokens: this.totalTokensToMint,
			status: 'failed',
			timestamp: new Date()
		});
	} finally {
		this.loading = false;
	}
},

		async testSingleConversion() {
			if (!this.hasUsersToConvert || !this.isOwner) {
				this.addStatusMessage('No users to convert or not authorized', 'error');
				return;
			}

			this.loading = true;

			try {
				const testUser = this.usersToConvert[0];

				this.addStatusMessage(`Testing conversion for ${testUser.Username}...`, 'info');

				const tx = await this.contract.methods
					.convertPointsToTokens(testUser.walletAddress, parseInt(testUser.UserBalance))
					.send({ from: this.connectedAccount });

				console.log('Single conversion successful:', tx);

				this.addStatusMessage('Single conversion test successful!', 'success');
				await this.loadContractData();
			} catch (error) {
				console.error('Single conversion error:', error);
				this.addStatusMessage(`Single conversion error: ${error.message}`, 'error');
			} finally {
				this.loading = false;
			}
		},

		async refreshUserData() {
			try {
				await this.loadUsers();
				if (this.contract) {
					await this.loadContractData();
				}
				this.addStatusMessage('Data refreshed successfully', 'success');
			} catch (error) {
				console.error('Refresh error:', error);
				this.addStatusMessage('Error refreshing data', 'error');
			}
		},

		getConversionStatusClass(user) {
			return {
				'status-converted': user.converted,
				'status-pending': !user.converted,
			};
		},

		getEtherscanUrl(txHash) {
			return `https://sepolia.etherscan.io/tx/${txHash}`;
		},

		addStatusMessage(text, type) {
			const message = {
				id: Date.now(),
				text,
				type
			};

			this.statusMessages.unshift(message);

			// Remove message after 5 seconds
			setTimeout(() => {
				const index = this.statusMessages.findIndex(m => m.id === message.id);
				if (index > -1) {
					this.statusMessages.splice(index, 1);
				}
			}, 5000);
		}
	}
};
</script>

<style scoped>
.admin-dashboard {
	max-width: 1200px;
	margin: 0 auto;
	padding: 20px;
	font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.connection-status {
	background: #f8f9fa;
	padding: 15px;
	border-radius: 8px;
	margin-bottom: 20px;
	border-left: 4px solid #dc3545;
}

.connection-status.connected {
	border-left-color: #28a745;
}

.connect-btn {
	background: #007bff;
	color: white;
	border: none;
	padding: 10px 20px;
	border-radius: 5px;
	cursor: pointer;
	margin-top: 10px;
	transition: background-color 0.3s;
}

.connect-btn:hover {
	background: #0056b3;
}

.contract-info {
	background: #e9ecef;
	padding: 15px;
	border-radius: 8px;
	margin-bottom: 20px;
}

.owner-warning {
	background: #fff3cd;
	color: #856404;
	padding: 12px;
	border-radius: 8px;
	margin-bottom: 20px;
	border: 1px solid #ffeaa7;
}

.users-section {
	margin-bottom: 30px;
}

.users-list {
	max-height: 300px;
	overflow-y: auto;
	border: 1px solid #dee2e6;
	border-radius: 8px;
}

.no-users {
	padding: 20px;
	text-align: center;
	color: #6c757d;
	border: 1px solid #dee2e6;
	border-radius: 8px;
}

.user-item {
	display: grid;
	grid-template-columns: 2fr 2fr 1fr 1fr;
	gap: 15px;
	padding: 10px 15px;
	border-bottom: 1px solid #e9ecef;
	align-items: center;
	font-size: 14px;
}

.user-item:last-child {
	border-bottom: none;
}

.status-converted {
	color: #28a745;
	font-weight: bold;
}

.status-pending {
	color: #ffc107;
	font-weight: bold;
}

.conversion-summary {
	background: #d1ecf1;
	padding: 15px;
	border-radius: 8px;
	margin-bottom: 20px;
	border: 1px solid #bee5eb;
}

.action-buttons {
	display: flex;
	gap: 15px;
	margin-bottom: 20px;
	flex-wrap: wrap;
}

.convert-all-btn {
	background: #28a745;
	color: white;
	border: none;
	padding: 12px 24px;
	border-radius: 5px;
	cursor: pointer;
	font-size: 16px;
	font-weight: bold;
	transition: background-color 0.3s;
}

.convert-all-btn:hover:not(:disabled) {
	background: #218838;
}

.convert-all-btn:disabled {
	background: #6c757d;
	cursor: not-allowed;
}

.refresh-btn,
.check-status-btn,
.test-btn {
	background: #17a2b8;
	color: white;
	border: none;
	padding: 12px 24px;
	border-radius: 5px;
	cursor: pointer;
	transition: background-color 0.3s;
}

.refresh-btn:hover:not(:disabled),
.check-status-btn:hover:not(:disabled),
.test-btn:hover:not(:disabled) {
	background: #138496;
}

.refresh-btn:disabled,
.check-status-btn:disabled,
.test-btn:disabled {
	background: #6c757d;
	cursor: not-allowed;
}

.test-btn {
	background: #fd7e14;
}

.test-btn:hover:not(:disabled) {
	background: #e8680a;
}

.transaction-history {
	margin-top: 30px;
}

.transaction-list {
	border: 1px solid #dee2e6;
	border-radius: 8px;
}

.transaction-item {
	display: grid;
	grid-template-columns: 150px 100px 120px 100px 1fr;
	gap: 15px;
	padding: 10px 15px;
	border-bottom: 1px solid #e9ecef;
	align-items: center;
	font-size: 14px;
}

.transaction-item:last-child {
	border-bottom: none;
}

.transaction-item a {
	color: #007bff;
	text-decoration: none;
}

.transaction-item a:hover {
	text-decoration: underline;
}

.status-success {
	color: #28a745;
	font-weight: bold;
}

.status-failed {
	color: #dc3545;
	font-weight: bold;
}

.status-messages {
	position: fixed;
	top: 20px;
	right: 20px;
	z-index: 1000;
	max-width: 350px;
}

.status-message {
	padding: 12px 16px;
	margin-bottom: 10px;
	border-radius: 6px;
	color: white;
	font-weight: 500;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
	from {
		transform: translateX(100%);
		opacity: 0;
	}

	to {
		transform: translateX(0);
		opacity: 1;
	}
}

.status-message.success {
	background: #28a745;
}

.status-message.error {
	background: #dc3545;
}

.status-message.info {
	background: #17a2b8;
}

/* Responsive Design */
@media (max-width: 768px) {
	.admin-dashboard {
		padding: 10px;
	}

	.user-item {
		grid-template-columns: 1fr;
		gap: 5px;
		padding: 15px;
	}

	.transaction-item {
		grid-template-columns: 1fr;
		gap: 5px;
	}

	.action-buttons {
		flex-direction: column;
	}

	.action-buttons button {
		width: 100%;
	}

	.status-messages {
		left: 10px;
		right: 10px;
		max-width: none;
	}
}
</style>
