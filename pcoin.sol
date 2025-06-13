// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

contract PCoin {
    string public name = "Penjwen coin";
    string public symbol = "PC";
    uint8 public decimals = 18;
    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // Track converted users to prevent double conversion
    mapping(address => bool) public hasBeenConverted;

    address public owner;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);
    event Converted(address indexed user, uint256 pointBalance, uint256 tokenAmount);
    event BatchConversionCompleted(uint256 totalUsers, uint256 totalTokensMinted);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor() {
        owner = msg.sender;
        // Fix: Set initial total supply to 10,000,000 tokens
        _totalSupply = 10000000 * 10**decimals;
        // Fix: Allocate all initial tokens to the contract owner
        _balances[owner] = _totalSupply;
        // Emit transfer event for initial mint
        emit Transfer(address(0), owner, _totalSupply);
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) public returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address ownerAddr, address spender) public view returns (uint256) {
        return _allowances[ownerAddr][spender];
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
        uint256 currentAllowance = _allowances[sender][msg.sender];
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");

        _transfer(sender, recipient, amount);
        _approve(sender, msg.sender, currentAllowance - amount);

        return true;
    }

    function mint(address to, uint256 amount) public onlyOwner {
        require(to != address(0), "ERC20: mint to the zero address");
        require(amount > 0, "Amount must be greater than 0");

        _totalSupply += amount;
        _balances[to] += amount;

        emit Transfer(address(0), to, amount);
        emit Mint(to, amount);
    }

    function convertPointsToTokens(address userAddress, uint256 userPoints) public onlyOwner {
        require(userAddress != address(0), "Invalid user address");
        require(userPoints > 0, "Points must be greater than 0");
        require(!hasBeenConverted[userAddress], "User already converted");

        uint256 tokenAmount = userPoints * 10**decimals;

        hasBeenConverted[userAddress] = true;
        _totalSupply += tokenAmount;
        _balances[userAddress] += tokenAmount;

        emit Transfer(address(0), userAddress, tokenAmount);
        emit Mint(userAddress, tokenAmount);
        emit Converted(userAddress, userPoints, tokenAmount);
    }

    function batchConvertPointsToTokens(
        address[] memory users,
        uint256[] memory points
    ) public onlyOwner {
        require(users.length == points.length, "Array length mismatch");
        require(users.length > 0, "Arrays cannot be empty");

        uint256 totalTokensMinted = 0;
        uint256 successfulConversions = 0;

        for (uint256 i = 0; i < users.length; i++) {
            address userAddress = users[i];
            uint256 userPoints = points[i];

            // Skip invalid entries instead of reverting the entire batch
            if (userAddress == address(0) || userPoints == 0 || hasBeenConverted[userAddress]) {
                continue;
            }

            uint256 tokenAmount = userPoints * 10**decimals;

            hasBeenConverted[userAddress] = true;
            _totalSupply += tokenAmount;
            _balances[userAddress] += tokenAmount;
            totalTokensMinted += tokenAmount;
            successfulConversions++;

            emit Transfer(address(0), userAddress, tokenAmount);
            emit Mint(userAddress, tokenAmount);
            emit Converted(userAddress, userPoints, tokenAmount);
        }

        emit BatchConversionCompleted(successfulConversions, totalTokensMinted);
    }

    function resetConversionStatus(address userAddress) public onlyOwner {
        hasBeenConverted[userAddress] = false;
    }

    function batchResetConversionStatus(address[] memory users) public onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            hasBeenConverted[users[i]] = false;
        }
    }

    function burn(uint256 amount) public {
        require(_balances[msg.sender] >= amount, "ERC20: burn amount exceeds balance");

        _balances[msg.sender] -= amount;
        _totalSupply -= amount;

        emit Transfer(msg.sender, address(0), amount);
        emit Burn(msg.sender, amount);
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");
        require(_balances[sender] >= amount, "ERC20: transfer amount exceeds balance");

        _balances[sender] -= amount;
        _balances[recipient] += amount;

        emit Transfer(sender, recipient, amount);
    }

    function _approve(address ownerAddr, address spender, uint256 amount) internal {
        require(ownerAddr != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[ownerAddr][spender] = amount;
        emit Approval(ownerAddr, spender, amount);
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function withdrawETH() public onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    function getConversionStatus(address userAddress) public view returns (bool) {
        return hasBeenConverted[userAddress];
    }

    // Utility function for debugging error messages (simplified version)
    function uint2str(uint256 _i) internal pure returns (string memory str) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bstr[k] = bytes1(temp);
            _i /= 10;
        }
        str = string(bstr);
    }
}