import { readdir, readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { cwd } from 'node:process'
import { PieceMetadata } from '@activepieces/pieces-framework'
import { extractPieceFromModule, PieceCategory } from '@activepieces/shared'
import * as semver from 'semver'
import { logger } from '../logger'

type Piece = {
    name: string
    displayName: string
    version: string
    minimumSupportedRelease?: string
    maximumSupportedRelease?: string
    metadata(): Omit<PieceMetadata, 'name' | 'version'>
}

export type PackageJson = {
    name: string
    version: string
    keywords: string[]
}

export const PIECES_FOLDER = 'packages/pieces'
export const COMMUNITY_PIECE_FOLDER = 'packages/pieces/community'


async function findAllPiecesFolder(folderPath: string): Promise<string[]> {
    const paths = []
    const files = await readdir(folderPath)

    for (const file of files) {
        const filePath = join(folderPath, file)
        const fileStats = await stat(filePath)
        if (
            fileStats.isDirectory() &&
            file !== 'node_modules' &&
            file !== 'dist' &&
            file !== 'framework' &&
            file !== 'common'
        ) {
            paths.push(...(await findAllPiecesFolder(filePath)))
        }
        else if (file === 'package.json') {
            paths.push(folderPath)
        }
    }
    return paths
}



const readJsonFile = async <T> (path: string): Promise<T> => {
    const jsonFile = await readFile(path, { encoding: 'utf-8' })
    return JSON.parse(jsonFile) as T
}
const readPackageJson = async (path: string): Promise<PackageJson> => {
    return readJsonFile(`${path}/package.json`)
}



const validateSupportedRelease = (minRelease: string | undefined, maxRelease: string | undefined): void => {
    if (minRelease !== undefined && !semver.valid(minRelease)) {
        throw Error('[validateSupportedRelease] "minimumSupportedRelease" should be a valid semver version')
    }

    if (maxRelease !== undefined && !semver.valid(maxRelease)) {
        throw Error('[validateSupportedRelease] "maximumSupportedRelease" should be a valid semver version')
    }

    if (minRelease !== undefined && maxRelease !== undefined && semver.gt(minRelease, maxRelease)) {
        throw Error('[validateSupportedRelease] "minimumSupportedRelease" should be less than "maximumSupportedRelease"')
    }
}

const validateMetadata = (pieceMetadata: PieceMetadata): void => {
    logger.info(`[validateMetadata] pieceName=${pieceMetadata.name}`)
    validateSupportedRelease(
        pieceMetadata.minimumSupportedRelease,
        pieceMetadata.maximumSupportedRelease,
    )
    validatePremiumPiece(pieceMetadata)
}

const validatePremiumPiece = (piece: PieceMetadata): void => {
    const categories = piece.categories ?? []

    if (piece.directoryPath?.includes('/ee/') && !categories.includes(PieceCategory.PREMIUM)) {
        throw Error('[validatePremiumPiece] Premium pieces must be in the \'premium\' category')
    }
    if (categories.includes(PieceCategory.PREMIUM) && (!piece.minimumSupportedRelease || semver.lt(piece.minimumSupportedRelease, '0.27.1'))) {
        throw Error('[validatePremiumPiece] Premium pieces must have a minimum supported release of 0.27.1 or higher')
    }
}

const byDisplayNameIgnoreCase = (a: PieceMetadata, b: PieceMetadata) => {
    const aName = a.displayName.toUpperCase()
    const bName = b.displayName.toUpperCase()
    return aName.localeCompare(bName, 'en')
}

async function findAllDistPaths(): Promise<string[]> {
    const baseDir = resolve(cwd(), 'dist', 'packages')
    const standardPiecesPath = resolve(baseDir, 'pieces')
    const enterprisePiecesPath = resolve(baseDir, 'ee', 'pieces')
    const paths = [
        ...await traverseFolder(standardPiecesPath),
        ...await traverseFolder(enterprisePiecesPath),
    ]
    return paths
}

async function traverseFolder(folderPath: string): Promise<string[]> {
    const paths: string[] = []
    const directoryExists = await stat(folderPath).catch(() => null)

    if (directoryExists && directoryExists.isDirectory()) {
        const files = await readdir(folderPath)

        for (const file of files) {
            const filePath = join(folderPath, file)
            const fileStats = await stat(filePath)
            if (fileStats.isDirectory() && file !== 'node_modules' && file !== 'dist') {
                paths.push(...await traverseFolder(filePath))
            }
            else if (file === 'package.json') {
                paths.push(folderPath)
            }
        }
    }
    return paths
}

async function loadPieceFromFolder(folderPath: string): Promise<PieceMetadata | null> {
    try {
        const packageJson = await readPackageJson(folderPath)

        const module = await import(
            join(folderPath, 'src', 'index')
        )

        const { name: pieceName, version: pieceVersion } = packageJson
        const piece = extractPieceFromModule<Piece>({
            module,
            pieceName,
            pieceVersion,
        })

        const metadata = {
            ...piece.metadata(),
            name: packageJson.name,
            version: packageJson.version,
        }
        metadata.directoryPath = folderPath
        metadata.name = packageJson.name
        metadata.version = packageJson.version
        metadata.minimumSupportedRelease = piece.minimumSupportedRelease ?? '0.0.0'
        metadata.maximumSupportedRelease =
            piece.maximumSupportedRelease ?? '99999.99999.9999'


        validateMetadata(metadata)
        return metadata
    }
    catch (ex) {
        logger.error(ex)
    }
    return null
}

export async function findDirectoryByPackageName(packageName: string): Promise<string | null> {
    const paths = await findAllPiecesFolder(resolve(cwd(), 'dist', 'packages', 'pieces'))
    for (const path of paths) {
        try {
            const packageJson = await readFile(join(path, 'package.json'), 'utf-8').then(JSON.parse)
            if (packageJson.name === packageName) {
                return path
            }
        }
        catch (e) {
            logger.error({
                name: 'findDirectoryByPackageName',
                message: JSON.stringify(e),
            }, 'Error finding directory by package name')
        }
    }
    return null
}

export function getCommunityPieceFolder(pieceName: string): string {
    return join(COMMUNITY_PIECE_FOLDER, pieceName)
}

export async function findPiece(pieceName: string): Promise<PieceMetadata | null> {
    const pieces = await findAllPieces()
    return pieces.find((p) => p.name === pieceName) ?? null
}

export async function findAllPiecesDirectoryInSource(): Promise<string[]> {
    const piecesPath = resolve(cwd(), 'packages', 'pieces')
    const paths = await traverseFolder(piecesPath)
    const enterprisePiecesPath = resolve(cwd(), 'packages', 'ee', 'pieces')
    const enterprisePiecesPaths = await traverseFolder(enterprisePiecesPath)
    return [...paths, ...enterprisePiecesPaths]
}

export async function findPieceDirectoryInSource(pieceName: string): Promise<string | null> {
    const piecesPath = await findAllPiecesDirectoryInSource()
    const piecePath = piecesPath.find((p) => p.includes(pieceName))
    return piecePath ?? null
}

export async function findAllPieces(): Promise<PieceMetadata[]> {
    const paths = await findAllDistPaths()
    const pieces = await Promise.all(paths.map((p) => loadPieceFromFolder(p)))
    return pieces.filter((p): p is PieceMetadata => p !== null).sort(byDisplayNameIgnoreCase)
}

export const filePiecesUtils = {
    findAllPiecesFolder,
    findDirectoryByPackageName,
}
