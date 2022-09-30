import { Contract, providers, utils } from "ethers";
import Head from "next/head";
import React, { useEffect, useRef, useState } from "react";
import Web3Modal from "web3modal";
import { abi, NFT_CONTRACT_ADDRESS } from "../constants";
import styles from "../styles/Home.module.css";

export default function Home() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [presaleStarted, setPresaleStarted] = useState(false);
  const [presaleEnded, setPresaleEnded] = useState(false);
  // loading is set to true when we are waiting for a transaction to get mined
  const [loading, setLoading] = useState(false);
  // checks if the currently connected MetaMask wallet is the owner of the contract
  const [isOwner, setIsOwner] = useState(false);
  const [tokenIdsMinted, setTokenIdsMinted] = useState("0");
  //Reference to the Web3 Modal (used to connect with MetaMask) whitch persists as long as page is open.
  const web3ModalRef = useRef();

  const [theOwner, setTheOwner] = useState("0");

  /**
   * presaleMint: Mint an NFT during the presale
   */
  const presaleMint = async () => {
    try {
      // Signer required here since there is a 'write' transaction.
      const signer = await getProviderOrSigner(true);
      
      // Create new instance of the Contract with a Signer, which allows update methods
      const whitelistContract = new Contract(
        NFT_CONTRACT_ADDRESS,
        abi,
        signer
      );

      //call the presaleMint fron the contract, only whitelisted addresses would be able to mint
      const tx = await whitelistContract.presaleMint({
        // value signifies the cost of one FaizFriend which is "0.01" eth.
        // We are parsing '0.01' string to ether using the utils library fron ethers.js
        value: utils.parseEther("0.01"),
      });
      setLoading(true);
      //wait for transaction to get mined
      await tx.wait();
      setLoading(false);
      window.alert("You successfully minted a Crypto Dev!");
    }
    catch (err) {
      console.error(err);
    }
  }

  /**
   * PublicMint: Mint an NFT after the presale
   */
  const publicMint = async () => {
    try {
      // Signer required because this is a write transaction.
      const signer = await getProviderOrSigner(true);
      // Create new instance of the Contract with a Signer, which allows us to update methods
      const whitelistContract = new Contract(
        NFT_CONTRACT_ADDRESS,
        abi,
        signer
      );
      // Call the mint from the contract to mint the Crypto dev
      const tx = await whitelistContract.mint({
        value: utils.parseEther("0.01"),
      })
      setLoading(true);
      await tx.wait();
      setLoading(false);
      window.alert("You successfully minted a Faiz Friend!");
    }
    catch (err) {
      console.error(err);
    }
  };

  /**
   * connectWallet: Connect the MetaMask wallet
   */
  const connectWallet = async () => {
    try {
      //Get provider from web3Modal, which is MetaMask
      //Prompts user to connect wallet if it is their first time
      await getProviderOrSigner();
      setWalletConnected(true);
    }
    catch (err) {
      console.error(err);
    }
  };

  /**
   * startPresale: starts the presale for the NFT collection
   */
  const startPresale = async () => {
    try {
      //get signer because this is a write function to the blockchain
      const signer = await getProviderOrSigner(true);

      const whitelistContract = new Contract (
        NFT_CONTRACT_ADDRESS,
        abi,
        signer
      );

      setLoading(true);
      const tx = await whitelistContract.startPresale();
      await tx.wait();
      setLoading(false);

      //set presale started to true
      await checkIfPresaleStarted();
    }
    catch (err) {
      console.log(err);
    }
  };

  /**
   * checkIfPresaleStarted: checks if the presale has started by quering the `presaleStarted`
   * variable in the contract
   */

  const checkIfPresaleStarted = async () => {
    try {
      //get provider because we will be reading from blockchain
      const provider = await getProviderOrSigner();

      const nftContract = new Contract (
        NFT_CONTRACT_ADDRESS,
        abi,
        provider
      );

      const _presaleStarted = await nftContract.presaleStarted();
      if (!_presaleStarted) {
        await getOwner();
      }

      setPresaleStarted(_presaleStarted);
      return _presaleStarted;
    }
    catch (err) {
      console.log(err);
      return false;
    }
  }
  
  /**
   * checkIfPresaleEnded: checks if the presale has ended by quering the `presaleEnded`variable in the contract
   */
  const checkIfPresaleEnded = async () => {
    try {
      const provider = await getProviderOrSigner();

      const whitelistContract = new Contract(
        NFT_CONTRACT_ADDRESS,
        abi,
        provider
      );

      const _presaleEnded = await whitelistContract.presaleEnded();
      // _presaleEnded is a Big Number, so we are using the lt(less than function) instead of `<`
      // Date.now()/1000 returns the current time in seconds
      // We compare if the _presaleEnded timestamp is less than the current time
      // which means presale has ended
      const hasEnded = _presaleEnded.lt(Math.floor(Date.now() / 1000));
      if (hasEnded) {
        setPresaleEnded(true);
      }
      else {
        setPresaleEnded(false);
      }
      return hasEnded;
    }
    catch (err) {
      console.error(err);
      return false;
    }
  };

  /**
   * getOwner: calls the contract to retrieve the owner
   */
  const getOwner = async () => {
    try {
      const provider = await getProviderOrSigner();

      const whitelistContract = new Contract(
        NFT_CONTRACT_ADDRESS,
        abi,
        provider
      );

      const _owner = await whitelistContract.owner();
      setTheOwner(_owner.toString());
      console.log(_owner);

      // Get signer now to extract address of currently connected MetaMask account
      const signer = await getProviderOrSigner(true);
      // Get the address associated to signer
      const address = await signer.getAddress();
      if (address.toLowerCase() === _owner.toLowerCase()) {
        setIsOwner(true);
      }
    }
    catch (err) {
      console.error(err.message);
    } 
  }

  /**
   * getTokenIdsMinted: gets the number of tokenIds that have been minted
   */
  const getTokenIdsMinted = async () => {
    try {
      const provider = await getProviderOrSigner();

      const whitelistContract = new Contract(
        NFT_CONTRACT_ADDRESS,
        abi,
        provider
      );

      const _idsMinted = await whitelistContract.tokenIds();
      setTokenIdsMinted(_idsMinted.toString());
    }
    catch (err) {
      console.error(err)
    }
  };

  /**
   * Returns a Provider or Signer object representing the Ethereum RPC with or without the
   * signing capabilities of metamask attached
   *
   * A `Provider` is needed to interact with the blockchain - reading transactions, reading balances, reading state, etc.
   *
   * A `Signer` is a special type of Provider used in case a `write` transaction needs to be made to the blockchain, which involves the connected account
   * needing to make a digital signature to authorize the transaction being sent. Metamask exposes a Signer API to allow your website to
   * request signatures from the user using Signer functions.
   *
   * @param {*} needSigner - True if you need the signer, default false otherwise
   */
  const getProviderOrSignerOld = async (needSigner = false) => {
    // Connect to Metamask
    // Since we store `web3Modal` as a reference, we need to access the `current` value to get access to the underlying object
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    // If user is not connected to the Rinkeby network, let them know and throw an error
    const {chainId} = await web3Provider.getNetwork();
    if (chainId !== 4) {
      window.alert("Change the network to Rinkeby");
      throw new Error("Change the network to Rinkeby");
    }

    if (needSigner) {
      const signer = web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  };

  const getProviderOrSigner = async (needSigner = false) => {
    // Connect to Metamask
    // Since we store `web3Modal` as a reference, we need to access the `current` value to get access to the underlying object
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    // If user is not connected to the Goerli network, let them know and throw an error
    const { chainId } = await web3Provider.getNetwork();
    if (chainId !== 4) {
      window.alert("Change the network to Rinkeby");
      throw new Error("Change network to Rinkeby");
    }

    if (needSigner) {
      const signer = web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  };

  // useEffects are used to react to changes in state of the website
  // The array at the end of function call represents what state changes will trigger this effect
  // In this case, whenever the value of `walletConnected` changes - this effect will be called
  useEffect(() => {
    // if wallet not connected, create new instance of Web3Modal and connect the MetaMask wallet
    if (!walletConnected) {
      // Assign the Web3Modal class to the reference object by setting it's `current` value
      // The `current` value is persisted throughout as long as this page is open
      web3ModalRef.current = new Web3Modal({
        network: "rinkeby",
        providerOptions: {},
        disableInjectedProvider: false,
      });
      connectWallet();

      //Check presale Status
      const _presaleStarted = checkIfPresaleStarted();
      if (_presaleStarted) {
        checkIfPresaleEnded();
      }

      getTokenIdsMinted();

      //Set a 5 second interval to check if presale has ended
      const presaleEndedInterval = setInterval(async function () {
        const _presaleStarted = await checkIfPresaleStarted();
        if (_presaleStarted) {
          const _presaleEnded = await checkIfPresaleEnded();
          if (_presaleEnded) {
            clearInterval(presaleEndedInterval);
          }
        }
      }, 5 * 1000);
    }
  }, [walletConnected]);

  /**
   * renderButton: Returns a button based on the state of the dapp
   */
  const renderButton = () => {
    //If wallet is not connected, return a button which allows them to connect their wallet
    if (!walletConnected) {
      return (
        <button onClick={connectWallet} className={styles.button}>
          Connect your Wallet
        </button>
      );
    }

    //If we are waiting for something, show the loading button
    if (loading) {
      return ( 
      <button className={styles.button}>
        Loading...
      </button>
      );
    }

    //If connected user is owner, and presale has not started yet, allow them to start the presale
    if (isOwner && !presaleStarted) {
      return (
        <button className={styles.button} onClick ={startPresale}>
          Start Presale!
        </button>
      );
    }

    // If connected user is not the owner, but presale hasn't started yet, tell them that.
    if (!isOwner && !presaleStarted) {
      return (
        <button className={styles.button}>
          Presale has not started yet.
        </button>
      )
    }

    // If presale started, but hasn't ended yet, allow for minting during presale period
    if (presaleStarted && !presaleEnded) {
      return (
        <div>
          <div className = {styles.description}>
            Presale has started! If your address is whitelisted, mint a Faiz Friend exclusive NFT! 🥳
          </div>
          <button className={styles.button} onClick={presaleMint}>
            Presale Mint 🚀
          </button>
        </div>
      );
    }

    // If presale started and has ended, its time for public minting
    if (presaleStarted && presaleEnded) {
      return (
        <div>
          <div className= {styles.description}>
            Presale has ended, and public mint is live! 🥳
          </div>
          <button className={styles.button} onClick={publicMint}>
            Public Mint 🚀
          </button>
        </div>
      );
    }
  };

  return (
    <div>
      <Head>
        <title>Exclusive NFTs for Faiz's Friends</title>
        <h1>{theOwner}</h1>
        <meta name="description" content="Whitelist-Dapp" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to the Faiz Friends NFT Drop!</h1>
          <div className={styles.description}>
            Its an NFT collection for Friends of Faiz
          </div>
          <div className={styles.description}>
            {tokenIdsMinted}/20 have been minted
          </div>
          {renderButton()}
        </div>
        <div>
          <img className={styles.image} src="./cryptodevs/0.svg" />
        </div>
      </div>
      <footer className={styles.footer}>
        Made with &#10084; by Faiz
      </footer>
    </div>
  );




}  
