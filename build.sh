#!/bin/bash

# MinGW tweaks:
# 1/ python SSL CERTs
export SSL_CERT_FILE=$(python3 -m certifi)
# 2/ Edit emsdk/upstream/emscripten/emconfigure.py and add:
#    args.insert(0,"bash")
# on line 44. This fixes the 'no a win32 executabe' issue
# 3/ Each time build hangs on an EOF complaint, run it again ...

export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct)


CMAKE_DEF_OPTS=" \
	-DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=$(pwd)/prefix \
	-DCMAKE_C_COMPILER_LAUNCHER=ccache \
	-DCMAKE_BUILD_TYPE=MinSizeRel"

EMCC_FLAGS=" \
-s STRICT=1 \
-s ENVIRONMENT=worker \
-s ASYNCIFY=1 \
-s INVOKE_RUN=0 \
-s EXIT_RUNTIME=1 \
-s MALLOC=emmalloc \
-s INITIAL_MEMORY=33554432 \
-s EXPORTED_RUNTIME_METHODS=FS,stackAlloc,stringToUTF8OnStack,ccall \
-s EXPORTED_FUNCTIONS=_main,_fflush \
-s MODULARIZE=1 \
-s EXPORT_NAME=instantiate \
-s EXPORT_ES6=1 \
-s USE_ES6_IMPORT_META=1 \
-s WASM_BIGINT=1 \
-s TEXTDECODER=1 \
-s DISABLE_EXCEPTION_CATCHING=0 \
--pre-js $(pwd)/assert.js"

cd $(dirname $0)

check_dependencies() {
	deps=""
	ret=$(dpkg -l | grep ccache)
	if [[ "x${ret}x" == "xx" ]]; then
		deps="ccache"
	fi
	ret=$(dpkg -l | grep nodejs)
	if [[ "x${ret}x" == "xx" ]]; then
		deps="$deps nodejs"
	fi
	ret=$(dpkg -l | grep npm)
	if [[ "x${ret}x" == "xx" ]]; then
		deps="$deps npm"
	fi
	echo "sudo apt install -y $deps"
	sudo apt install -y $deps
}

# check if everything must be build or only one step.
build_zlib="false"
build_libusb="false"
build_libftdi="false"
build_openfpgaloader="false"
 
if [[ $# == 0 ]]; then
	build_zlib="true"
	build_libusb="true"
	build_libftdi="true"
	build_openfpgaloader="true"
else
    if [[ $1 == "all" ]]; then
		build_zlib="true"
		build_libusb="true"
		build_libftdi="true"
		build_openfpgaloader="true"
    elif [[ $1 == "none" ]]; then
		build_zlib="false"
		build_libusb="false"
		build_libftdi="false"
		build_openfpgaloader="false"
    else
        for tgt in $@; do
            if [[ $tgt == "zlib" ]]; then
                build_zlib="true"
            fi
            if [[ $tgt == "libusb" ]]; then
                build_libusb="true"
            fi
            if [[ $tgt == "libftdi" ]]; then
                build_libftdi="true"
            fi
            if [[ $tgt == "openfpgaloader" ]]; then
                build_openfpgaloader="true"
            fi
        done
    fi
fi

echo "a"
check_dependencies
echo "b"
#exit

# EMSDK

EMSDK_VERSION="3.1.51"
./emsdk/emsdk install ${EMSDK_VERSION}
./emsdk/emsdk activate ${EMSDK_VERSION}

export PATH=$(pwd)/emsdk:$(pwd)/emsdk/upstream/emscripten:${PATH}
export PKG_CONFIG_PATH=$(pwd)/prefix/lib/pkgconfig

# zlib

if [[ $build_zlib == "true" ]]; then
	emcmake cmake -S zlib-src -B zlib-build $CMAKE_DEF_OPTS \
	    -DINSTALL_PKGCONFIG_DIR=$(pwd)/prefix/lib/pkgconfig \
		-DZLIB_BUILD_EXAMPLES=OFF \
		-DZLIB_BUILD_TESTING=OFF \
		-DZLIB_BUILD_SHARED=OFF \
		-DZLIB_BUILD_STATIC=ON \
		-DZLIB_BUILD_MINIZIP=OFF \
	    -DCMAKE_C_FLAGS="-O2 -fexceptions -no-pthread"
	emmake make -C zlib-build install VERBOSE=1 -j$(nproc)
fi

# libusb

if [[ $build_libusb == "true" ]]; then
	[ -e ./libusb-src/configure ] || (
	    cd ./libusb-src &&
	    ./bootstrap.sh)
	[ -e ./libusb-build/Makefile ] || (
	    mkdir -p libusb-build &&
	    cd ./libusb-build &&
	    emconfigure ../libusb-src/configure \
	        CFLAGS="-O2 -fexceptions -DNO_PTHREAD -no-pthread -Wall" \
	        CPPFLAGS="-O2 -fexceptions -DNO_PTHREAD -no-pthread -Wall" \
	        --host=wasm32-emscripten \
			--disable-shared \
	        --prefix=$(realpath $(pwd)/../prefix))
	emmake make -C libusb-build install -j16
fi

# libftdi

if [[ $build_libftdi == "true" ]]; then
	emcmake cmake -S libftdi-src -B libftdi-build $CMAKE_DEF_OPTS \
	    -DCMAKE_INSTALL_LIBDIR="$(pwd)/prefix/lib" \
	    -DLIBUSB_INCLUDE_DIR="$(pwd)/prefix/include/libusb-1.0" \
	    -DLIBUSB_LIBRARIES="-L$(pwd)/prefix/lib -lusb-1.0" \
	    -DCMAKE_C_FLAGS="-O2 -fexceptions -no-pthread" \
	    -DFTDI_EEPROM=OFF \
	    -DEXAMPLES=OFF
	emmake make -C libftdi-build install VERBOSE=1 -j16
fi

# openFPGALoader

if [[ $build_openfpgaloader == "true" ]]; then
	[ -e ./openFPGALoader ] || git clone https://github.com/trabucayre/openFPGALoader
	emcmake cmake -S openFPGALoader -B openFPGALoader-build \
	    -DCMAKE_CXX_FLAGS="-fexceptions" \
	    -DCMAKE_EXE_LINKER_FLAGS="-O2 -no-pthread -lembind ${EMCC_FLAGS}" \
	    -DCMAKE_EXECUTABLE_SUFFIX_CXX=".mjs"
	emmake make -C openFPGALoader-build VERBOSE=1 -j$(nproc)
fi

# Install

mkdir -p npmjs/gen

cp openFPGALoader-build/openFPGALoader.* npmjs/gen
pushd npmjs
node prepare.mjs
npm install
npm run build

mkdir -p dist/
npm pack --pack-destination=dist/
popd
cp npmjs/bundle.js html/
cp npmjs/openFPGALoader.wasm html/
