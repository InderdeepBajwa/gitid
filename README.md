# GitID - Manage Multiple Git Identities Easily

GitID is a convenient command-line interface (CLI) that allows you seamlessly manage and switch between multiple git SSH identities on a single user account.

## Installation

```
npm install -g gitid
```

## Usage

Here's how you can use the different commands of this CLI:

- **Create new identity:**

  This will create a new `ed25519` SSH identity.

  ```
  gitid new <identity>
  ```

  ```
  # example
  gitid new personal
  ```

  Replace `<identity>` with the desired name for your new identity.

- **List identities:**

  This will list all available identities.

  ```
  gitid list
  ```

- **Check current identity:**

  This will output the current identity.

  ```
  gitid current
  ```

- **Use identity:**

  This will change the Git identity for the repository in the current directory to a specified identity.

  ```
  gitid use <identity>
  ```

  ```
  # example
  gitid use personal
  ```

  Replace `<identity>` with the name of the identity you want to use.

## Do I need GitID?

GitID is your solution if you are:

- Having a hard time managing multiple Git identity files on a single user account
- Struggling with permission issues when accidentally pushing from a wrong identity file
- Tired of having to modify git URLs every time you clone or add a new remote

## Manual Installation and Contribution

First, clone the repository:

```
git clone https://github.com/inderdeepbajwa/gitid.git
cd gitid
```

Then install the dependencies:

```
yarn install
```

Finally, build the code:

```
yarn run build
```

---

## Note

This CLI is meant for managing SSH identities on a single machine, the identity names you use are local to your machine and do not have to correspond to your actual GitHub username.

## License

MIT

---
