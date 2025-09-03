# openFPGALoader_webUSB

## Introduction

This project provides scripts to build **openFPGALoader** and its dependencies for use in
a **web/WebUSB** context.
It also provides a web page and a JavaScript file to access the most commonly used operations
performed by **openFPGALoader**.

This approach allows you to use **openFPGALoader** to load or write bitstreams directly in the
browser, without installing packages via a package manager or manually building the tool.

**Note:** Since this implementation uses JavaScript and WebAssembly, load/write sequences are
slower compared to the native binary version compiled for your computer.

### Repository structure

- `zlib-src`: zlib submodule
- `libusb-src`: libusb submodule
- `libftdi-src`: libftdi submodule
- `html`: HTML and JavaScript files

## Build / Install

### Prerequisites

To build openFPGALoader in WebAssembly (WASM), a few dependencies are required:

```bash
apt install git cmake python3 python3-certifi xz-utils ccache libtool pkg-config
```

### Clone the Repository

```bash
git clone --recursive https://github.com/trabucayre/openFPGALoader_webUSB
```

### Build

A ready-to-use script is provided at the top-level of the repository.
This script builds the libraries required by openFPGALoader as well as openFPGALoader itself:

```bash
./build.sh [opts]
```

`opts` is optional and specifies which operations to perform:

- `all` (or blank): builds **zlib**, **libusb**, **libftdi**, and **openFPGALoader**
- `zlib`: builds only **zlib**
- `libusb`: builds only **libusb**
- `libftdi`: builds only **libftdi**
- `openfpgaloader`: builds only **openFPGALoader**
- `none`: skips building and performs only the deploy step

### Notes

- Using `opts` values other than `openFPGALoader` is useful **after cloning** or
  **after checking out** a commit where submodules have been updated.
- Running `./build.sh openfpgaloader` will always update **openFPGALoader** to the latest commit.
- The deploy step runs only if **openFPGALoader** has been successfully built at least once.

## Web Server
For the sack of this discussion, and to simplify, we assume repository was cloned in `/srv` repository.

### Standalone python server

The python script *html/run.py* is a minimal web-server.

Prerequisites:
```bash
apt install python3-cryptography
```

Uses:
```bash
cd html
./run.py
```

### lighttpd

To install **lighttpd** with HTTPS support, run:

```bash
sudo apt install lighttpd lighttpd-mod-openssl
```

A ready-to-use configuration is provided in `server_config/lighttpd.conf`.

The key modifications are:
- Updated `server.modules` to include:
  - `mod_openssl`: enables HTTPS support
  - `mod_setenv`: add security headers required for `pthread` usage by `libusb`
- Updated `server.document-root` to point to the `openFPGALoader_webUSB/html` directory
- Added the following responses headers:
  ```lighttpd
  setenv.add-response-header = (
    "Cross-Origin-Opener-Policy" => "same-origin",
    "Cross-Origin-Embedder-Policy" => "require-corp"
  )
  ```

#### Generating a Self-Signed Certificate

To enable HTTPS, create a certificate:

```bash
sudo mkdir /etc/lighttpd/certs
sudo openssl req -new -x509 -keyout /etc/lighttpd/certs/lighttpd.pem -out /etc/lighttpd/certs/lighttpd.pem -days 365 -nodes
sudo chmod 400 /etc/lighttpd/certs/lighttpd.pem
```

#### Restart lighttpd server
```bash
sudo systemctl restart lighttpd.service
```