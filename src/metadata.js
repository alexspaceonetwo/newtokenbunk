import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
    mplTokenMetadata,
    fetchMetadata,
    findMetadataPda,
} from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';

export async function fetchTokenMetadata(connection, mintAddress) {
    const umi = createUmi(connection.rpcEndpoint).use(mplTokenMetadata());
    const mintPk = publicKey(mintAddress);
    const metadataPda = findMetadataPda(umi, { mint: mintPk });

    try {
        const metadata = await fetchMetadata(umi, metadataPda);
        let offChainData = null;

        if (metadata.uri) {
            try {
                const response = await fetch(metadata.uri);
                if (response.ok) {
                    offChainData = await response.json();
                }
            } catch {
                offChainData = null;
            }
        }

        return {
            name: metadata.name.replace(/\0/g, ''),
            symbol: metadata.symbol.replace(/\0/g, ''),
            uri: metadata.uri.replace(/\0/g, ''),
            updateAuthority: metadata.updateAuthority,
            isMutable: metadata.isMutable,
            offChainData,
        };
    } catch (error) {
        throw new Error(`Failed to fetch metadata for ${mintAddress}: ${error.message}`);
    }
}