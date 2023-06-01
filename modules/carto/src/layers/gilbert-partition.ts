/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
const PARTITION_UNPARTITIONED = 0;

export default class GilbertPartition {
	partitionCount: number;
	zRange: {zmin: number; zmax: number; zstep: number};
	zMaxBbox: {xmin: number; xmax: number; ymin: number; ymax: number};
	zstep: number;

	/**
	 * partitionCount: Number of partitions assigned for the whole dataset
	 * zRange: Range of accepted zoom levels (e.g: { zmin: 0, zmax: 15 })
	 * zMaxBbox: Bounding box of the dataset for the maximum accepted zoom level (i.e. zRange.zmax)
	 *            These are tile coordinates (x, y) not geography coordinates
	 */
	constructor(
		partitionCount: string | number,
		zRange: {zmin: string; zmax: string; zstep: string} /* { zmin, zmax, zstep } */,
		zMaxBbox: {
			xmin: string;
			xmax: string;
			ymin: string;
			ymax: string;
		} /* { xmin, xmax, ymin, ymax } */
	) {
		this.zstep = 1;
		this.partitionCount = parseInt(partitionCount as string);
		this.zRange = {
			zmin: parseInt(zRange.zmin),
			zmax: parseInt(zRange.zmax),
			zstep: parseInt(zRange.zstep)
		};
		this.zMaxBbox = {
			xmin: parseInt(zMaxBbox.xmin),
			xmax: parseInt(zMaxBbox.xmax),
			ymin: parseInt(zMaxBbox.ymin),
			ymax: parseInt(zMaxBbox.ymax)
		};

		if (!partitionCount || partitionCount < 1) {
			throw new Error(
				`Unexpected partition count. Expected a positive integer. Got ${partitionCount}`
			);
		}
		if (!this.zRange) {
			throw new Error('Missing zRange');
		}
		if (isNaN(this.zRange.zmin) || isNaN(this.zRange.zmax) || isNaN(this.zRange.zstep)) {
			throw new Error(
				`Invalid zRange. Both zmin, zmax and zstep need to be defined. Got ${JSON.stringify(
					zRange
				)}`
			);
		}
		if (this.zRange.zmin > this.zRange.zmax || this.zRange.zmin < 0 || this.zstep < 1) {
			throw new Error(`Invalid zRange received. Got (${JSON.stringify(zRange)})`);
		}
		if (!this.zMaxBbox) {
			throw new Error('Missing zMaxBbox');
		}
		if (
			isNaN(this.zMaxBbox.xmin) ||
			isNaN(this.zMaxBbox.xmax) ||
			isNaN(this.zMaxBbox.ymin) ||
			isNaN(this.zMaxBbox.ymax)
		) {
			throw new Error(
				`Invalid zMaxBbox. All xmin, xmax, ymin and ymax need to be defined. Got (${JSON.stringify(
					zMaxBbox
				)})`
			);
		}
		if (
			this.zMaxBbox.xmin > this.zMaxBbox.xmax ||
			this.zMaxBbox.xmin < 0 ||
			this.zMaxBbox.ymin > this.zMaxBbox.ymax ||
			this.zMaxBbox.ymin < 0
		) {
			throw new Error(`Invalid bbox received. Got (${JSON.stringify(zMaxBbox)})`);
		}
	}

	getPartition(tile = {z: 0, x: 0, y: 0}) {
		const rxmin = this.zMaxBbox.xmin >> (this.zRange.zmax - tile.z);
		const rxmax = this.zMaxBbox.xmax >> (this.zRange.zmax - tile.z);
		const rymin = this.zMaxBbox.ymin >> (this.zRange.zmax - tile.z);
		const rymax = this.zMaxBbox.ymax >> (this.zRange.zmax - tile.z);
		if (
			tile.z < this.zRange.zmin ||
			tile.z > this.zRange.zmax ||
			tile.x < rxmin ||
			tile.x > rxmax ||
			tile.y < rymin ||
			tile.y > rymax
		) {
			return PARTITION_UNPARTITIONED;
		}

		const partitionRange = partitionRangeByZoom(this.partitionCount, {
			z: tile.z,
			zmin: this.zRange.zmin,
			zmax: this.zRange.zmax,
			zstep: this.zRange.zstep
		});
		const usablePartitions = partitionRange.max - partitionRange.min + 1;
		if (usablePartitions === 1) {
			return partitionRange.min;
		}

		/* We switch to a rectangle starting at 0, 0 so it's easier to reason about it
		 * The rectangle goes from (0, 0) to (rwidth - 1, rheight - 1)
		 */
		const x = tile.x - rxmin;
		const y = tile.y - rymin;
		const rwidth = rxmax - rxmin + 1;
		const rheight = rymax - rymin + 1;
		const rectangleSize = rwidth * rheight;

		/* We need to divide this **rectangle** into equal sized areas, so what we do is to create a
		 * Hilbert curve and then divide this 1d line into the necessary parts.
		 *
		 * If this was a perfect square, we would interleave bits from x and y, but in a rectangle
		 * that would leave many empty spaces, so the partitions would be irregular (or some even empty)
		 *
		 * Instead we use a Generalized Hilbert curve based on https://github.com/jakubcerveny/gilbert
		 * by Jakub Červený
		 *
		 */
		const gilbertPosition = gilbert2dTile({x: x, y: y}, rwidth, rheight);
		if (gilbertPosition === -1 || gilbertPosition >= rwidth * rheight) {
			throw new Error(
				`Unexpected gilbert partition (${gilbertPosition}) for tile ${tile.z}/${tile.x}/${tile.y} => ${x}/${y} : ${rwidth}, ${rheight})`
			);
		}

		/* The gilbertPosition goes from 0 to rectangleSize - 1 */
		return partitionRange.min + Math.floor((usablePartitions * gilbertPosition) / rectangleSize);
	}
}

/**
 * Assigns partitions to zoom levels given the number of partitions and zoom ranges available
 * Partitions always start at 1 (0 is used for outside levels) and end at the **partitions** parameter
 *
 * On the default situation (zmin = 0) we assign to the max zoom level, 3/4ths of the available partitions
 * since approximately 75% of the tiles are always found in the highest zoom. Then, we assign 75%
 * of the **remaining** space to the zoom level right below it, 75%(75%(75%)) to the next one, and so on.
 *
 * When (zmin != 0) we divide the "saved" partition space in the same proportion as the full partition table
 *
 * When (zstep != 1) we assign those partitions to the next valid zoom level
 */
function partitionRangeByZoom(
	partitionCount: number,
	param: {
		z: any;
		zmin: any;
		zmax: any;
		zstep: any;
		partitionCount?: any;
	} /* {z, zmin, zmax, zstep} */
) {
	if (
		param.z < 0 ||
		param.zmin < 0 ||
		param.zmax < 0 ||
		param.zstep < 1 ||
		param.z < param.zmin ||
		param.z > param.zmax ||
		param.partitionCount < 1 ||
		(param.z !== param.zmin && (param.z - param.zmin) % param.zstep !== 0)
	) {
		return {min: PARTITION_UNPARTITIONED, max: PARTITION_UNPARTITIONED};
	}

	/* Adapt levels to always start from 0 */
	const zstep = param.zstep;
	const zmin = 0;
	let zmax = param.zmax - param.zmin;
	zmax = zmax - (zmax % zstep);
	const z = param.z - param.zmin;
	const rangeInitialZ = z - zstep + 1;

	const globalStart = 1;
	const globalEnd = partitionCount;

	if (zmin === zmax || globalStart === globalEnd) {
		return {min: globalStart, max: globalEnd};
	}

	/* Note that the z0 level gets special treatment since it gets the whole 100% of its remaining space */
	let zPartitions = 0;
	let partitionStart;
	if (z === 0) {
		zPartitions = (4 * globalEnd) / Math.pow(4, zmax + 1);
		partitionStart = 0;
	} else {
		for (let acc = rangeInitialZ; acc <= z; acc++) {
			zPartitions += (3 * globalEnd) / Math.pow(4, zmax - acc + 1);
		}
		partitionStart = globalEnd / Math.pow(4, zmax - rangeInitialZ + 1);
	}
	const partitionEnd = partitionStart + zPartitions;
	/* We round the start (instead of using floor) to give the lower zoom levels more partitions as
	 * they tend to be overcrowded, especially in rectangles with a great difference between height and width
	 */
	partitionStart = Math.round(partitionStart);
	return {
		min: partitionStart + globalStart,
		max: Math.min(globalEnd, Math.max(Math.floor(partitionEnd), partitionStart) + globalStart)
	};
}

/* Finds the position of `target` inside the Gilbert curve defined by the rectangle:
 * cursor: Current position (start)
 * vectorMain: Main direction of movement.
 *              It should move only on one axis, and it can be positive or negative.
 * vectorSec: Secondary direction of movement. Orthogonal to and smaller than vectorMain.
 *
 * This is currently recursive, so the value is being add up inside target.counter
 */
function gilbert2d(
	cursor: {x: any; y: any} /* { x, y } */,
	vectorMain: {x: any; y: any} /* {x, y} */,
	vectorSec: {x: any; y: any} /* {x, y} */,
	target: {x: any; y: any; counter: any} /* { counter, x, y } */
): number {
	/* Vector direction of movement (-1, 0 or +1) */
	const mainDirX = Math.sign(vectorMain.x);
	const mainDirY = Math.sign(vectorMain.y);
	const secDirX = Math.sign(vectorSec.x);
	const secDirY = Math.sign(vectorSec.y);

	const xmin = Math.min(cursor.x, cursor.x + vectorMain.x - mainDirX + vectorSec.x - secDirX);
	const xmax = Math.max(cursor.x, cursor.x + vectorMain.x - mainDirX + vectorSec.x - secDirX);
	const ymin = Math.min(cursor.y, cursor.y + vectorMain.y - mainDirY + vectorSec.y - secDirY);
	const ymax = Math.max(cursor.y, cursor.y + vectorMain.y - mainDirY + vectorSec.y - secDirY);
	if (target.x < xmin || target.x > xmax || target.y < ymin || target.y > ymax) {
		/* The tile we are looking for is not insde this rectangle. Add up its size and do a fast exit */
		target.counter += (xmax - xmin + 1) * (ymax - ymin + 1);
		return -1;
	}

	/* We can calculate the magnitude of the vectors this way because one of the coordinates
	 * will always be 0 */
	const vectorMainMagnitude = Math.abs(vectorMain.x + vectorMain.y);
	const vectorSecMagnitude = Math.abs(vectorSec.x + vectorSec.y);

	if (vectorMainMagnitude === 1 || vectorSecMagnitude === 1) {
		/* We have either one row or one column. Either way, the position is the distance between
		 * the current point and the target */
		target.counter += Math.abs(cursor.x - target.x + (cursor.y - target.y));
		return target.counter;
	}

	const vectorMainHalf = {
		x: Math.floor(vectorMain.x / 2),
		y: Math.floor(vectorMain.y / 2)
	};

	if (2 * vectorMainMagnitude > 3 * vectorSecMagnitude) {
		const vectorMainHalfMagnitude = Math.abs(vectorMainHalf.x + vectorMainHalf.y);
		if (vectorMainHalfMagnitude % 2 && vectorMainMagnitude > 2) {
			/* Prefer even steps */
			vectorMainHalf.x += mainDirX;
			vectorMainHalf.y += mainDirY;
		}

		/* We split the main vector into 2 parts */
		const first = gilbert2d({x: cursor.x, y: cursor.y}, vectorMainHalf, vectorSec, target);
		if (first !== -1) {
			return first;
		}
		return gilbert2d(
			{x: cursor.x + vectorMainHalf.x, y: cursor.y + vectorMainHalf.y},
			{x: vectorMain.x - vectorMainHalf.x, y: vectorMain.y - vectorMainHalf.y},
			vectorSec,
			target
		);
	} else {
		const vectorSecHalf = {
			x: Math.floor(vectorSec.x / 2),
			y: Math.floor(vectorSec.y / 2)
		};
		const vectorSecHalfMagnitude = Math.abs(vectorSecHalf.x + vectorSecHalf.y);
		if (vectorSecHalfMagnitude % 2 && vectorSecMagnitude > 2) {
			/* Prefer even steps */
			vectorSecHalf.x += secDirX;
			vectorSecHalf.y += secDirY;
		}

		/* We split the whole rectangle into 3 parts */

		/* Bottom half left (flipped so it finishes on top of the starting point) */
		const first = gilbert2d({x: cursor.x, y: cursor.y}, vectorSecHalf, vectorMainHalf, target);
		if (first !== -1) {
			return first;
		}

		/* Top (left to right) */
		const second = gilbert2d(
			{x: cursor.x + vectorSecHalf.x, y: cursor.y + vectorSecHalf.y},
			vectorMain,
			{x: vectorSec.x - vectorSecHalf.x, y: vectorSec.y - vectorSecHalf.y},
			target
		);
		if (second !== -1) {
			return second;
		}

		/* Bottom half right */
		return gilbert2d(
			{
				x: cursor.x + (vectorMain.x - mainDirX) + (vectorSecHalf.x - secDirX),
				y: cursor.y + (vectorMain.y - mainDirY) + (vectorSecHalf.y - secDirY)
			},
			{x: -vectorSecHalf.x, y: -vectorSecHalf.y},
			{x: -(vectorMain.x - vectorMainHalf.x), y: -(vectorMain.y - vectorMainHalf.y)},
			target
		);
	}
}

/**
 * Given a rectangle coordinate (x : [0, width) ^ y : [ 0 .. height)) and its height and width,
 * it returns the position of the given coordinate in the Gilbert curve filling the rectangle
 * The result will be an integer number n : [0, (width * height) - 1]
 */
function gilbert2dTile(targetTile: {x: any; y: any} /* {x, y} */, width: number, height: number) {
	if (width < 1 || height < 1) {
		throw new Error(`Invalid Gilbert rectangle. Got: Width (${width}). Height: (${height})`);
	}
	const tile = {x: targetTile.x, y: targetTile.y, counter: 0};
	const startPoint = {x: 0, y: 0};

	let mainVector = {x: 0, y: height};
	let secondaryVector = {x: width, y: 0};
	if (width > height) {
		mainVector = {x: width, y: 0};
		secondaryVector = {x: 0, y: height};
	}
	return gilbert2d(startPoint, mainVector, secondaryVector, tile);
}
