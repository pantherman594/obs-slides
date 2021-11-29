import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import OBSWebSocket from 'obs-websocket-js';
import debounce from 'debounce';

import AppsIcon from '@mui/icons-material/Apps';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import CardActionArea from '@mui/material/CardActionArea';
import Dialog from '@mui/material/Dialog';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import Overview from './Overview';
import {
	client_id,
	client_secret,
	redirect_uri,
} from './oauth_config';

const scope = 'https://www.googleapis.com/auth/presentations.readonly';
const state = 'state-token';

const oauthUrl = `https://accounts.google.com/o/oauth2/auth?access_type=offline&client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${encodeURIComponent(scope)}&${encodeURIComponent(state)}`;

const App = ({ token }) => {
	const [slideNonce, setSlideNonce] = useState(0);
	const [id, setId] = useState('');
	const [slideIndex, setSlideIndex] = useState(-1);
	const [imgCache, setImgCache] = useState({});
	const [obs, setObs] = useState(null);
	const [overviewOpen, setOverviewOpen] = useState(false);

	const imgCacheR = useRef({});
	const slidesR = useRef([]);
	const slides = slidesR.current;

	const authed = token !== '';

	// Set up OBS Websocket.
	useEffect(() => {
		(async () => {
			const obs = new OBSWebSocket();
			await obs.connect({ address: 'localhost:4444', password: 'DavidShen' });

			obs.on('BroadcastCustomMessage', ({ realm, data }) => {
				if (realm !== 'obs-slides-controller') return;

				let { command, args } = data;
				if (command !== 'updateSlides') return;
				args = JSON.parse(args);

				setSlideNonce((oldNonce) => {
					if (args[0] < oldNonce) return oldNonce;

					setId(args[1]);
					setSlideIndex(args[2]);
					slidesR.current = args[3];
					return args[0];
				});
			});

			setObs(obs);
		})();
	}, []);

	const sendCommand = useCallback((command, ...args) => {
		if (!obs) return;

		obs.send('BroadcastCustomMessage', {
			realm: 'obs-slides-client',
			data: {
				command,
				args: JSON.stringify(args),
			},
		});
	}, [obs]);

	useEffect(() => {
		authed && sendCommand('getSlides');
	}, [authed, sendCommand]);

	useEffect(() => {
		return () => obs && obs.disconnect();
	}, [obs]);

	useEffect(() => {
		setImgCache({});
	}, [authed, slideNonce, id]);

	useEffect(() => {
		imgCacheR.current = imgCache;
	}, [imgCache]);

	// Fetch the image of a slide and cache the url.
	const cacheImage = useCallback((slideId) => {
		// eslint-disable-next-line
		slideNonce;

		(async () => {
			if (!authed) return;
			if (id === '') return;
			if (imgCacheR.current[slideId] !== undefined) return;

			// Prevent another request for this image before it finishes.
			setImgCache((old) => ({ ...old, [slideId]: false }));

			let response;
			try {
				// response = await gClient.slides.presentations.pages.getThumbnail({
				// 	pageObjectId: slideId,
				// 	presentationId: id,
				// });

				const resp = await fetch(`https://slides.googleapis.com/v1/presentations/${id}/pages/${slideId}/thumbnail?access_token=${token}`);
				response = await resp.json();
			} catch (err) {
				console.error(err);
				// Request failed, clear the lock.
				setImgCache(({ [slideId]: _remove, old }) => old || {});
				return;
			}

			// if (response.status !== 200) return;

			// const url = response.result.contentUrl;
			const url = response.contentUrl;

			setImgCache((old) => ({ ...old, [slideId]: url }));
		})();

		return './placeholder.png';
	// }, [authed, slideNonce, id, gClient.slides.presentations.pages]);
	}, [authed, slideNonce, id, token]);


	const nextSlide = useCallback(() => sendCommand('nextSlide'), [sendCommand]);
	const prevSlide = useCallback(() => sendCommand('prevSlide'), [sendCommand]);
	const setSlide = useCallback((num) => sendCommand('setSlide', num), [sendCommand]);
	const reloadSlides = useCallback(() => sendCommand('reloadSlides'), [sendCommand]);

	// Listen for keyboard events.
	useEffect(() => {
		const listener = (ev) => {
			switch(ev.keyCode) {
				case 34: // pg down
				case 39: // right
				case 40: // down
				case 13: // enter
				case 32: // space
					nextSlide();
					break;
				case 33: // pg up
				case 37: // left
				case 38: // up
					prevSlide();
					break;
				case 36: { // home
					let first = 0;
					while (!slidesR.current[first].visible) first += 1;
					setSlide(first + 1);
					break;
				}
				case 35: { // end
					let last = slidesR.current.length - 1;
					while (!slidesR.current[last].visible) last -= 1;
					setSlide(last + 1);
					break;
				}
				case 82: // r
					reloadSlides();
				default:
					return;
			}

			ev.preventDefault();
		};

		document.body.addEventListener('keydown', listener);

		return () => document.body.removeEventListener('keydown', listener);
	}, [nextSlide, prevSlide, setSlide, reloadSlides]);

	const slide = slides[slideIndex];

	let prev = slides[slideIndex - 1];
	while (prev && !prev.visible) {
		prev = slides[prev.index - 1];
	}
	const prevIndex = prev ? prev.index : -1;

	let next = slides[slideIndex + 1];
	while (next && !next.visible) {
		next = slides[next.index + 1];
	}
	const nextIndex = next ? next.index : -1;

	// Cache the image urls for the 5 slides around the current one.
	useEffect(() => {
		const slides = slidesR.current;
		for (let i = Math.max(0, slideIndex - 2); i < Math.min(slides.length, slideIndex + 3); i++) {
			cacheImage(slides[i].id);
		}
		prevIndex >= 0 && cacheImage(slides[prevIndex].id);
		nextIndex >= 0 && cacheImage(slides[nextIndex].id);
	}, [slideIndex, prevIndex, nextIndex, cacheImage]);

	useEffect(() => {
		const slides = slidesR.current;

		const timeouts = slides.map((slide, i) =>
			setTimeout(() => cacheImage(slide.id), i * 500)
		);

		return () => {
			timeouts.forEach(clearTimeout);
		};
	}, [cacheImage]);

  if (!authed) {
    return (<Typography variant='h6' align='center'>
      Please sign in below to continue
    </Typography>);
  }

	if (id === '' || slideIndex < 0 || slides.length === 0 || !slide) {
    return (<Typography variant='h6' align='center'>
      Waiting for slides...
    </Typography>);
	}

	return (
		<Paper sx={{ m: 2 }} elevation={0}>
			<Dialog
        fullScreen
				sx={{ m: 2 }}
        open={overviewOpen}
				onClose={() => setOverviewOpen(false)}
      >
				<Overview
					slides={slides}
					imgCache={imgCache}
					placeholder={'./placeholder.png'}
					onClick={(i) => setSlide(i + 1)}
				/>
			</Dialog>

			<Stack spacing={2}>
				<Grid container spacing={1} alignItems='center' justifyContent='center'>
					<Grid item xs={10}>
						<Select
							fullWidth
							variant='standard'
							id='slide-select'
							value={slideIndex}
							onChange={(ev) => setSlide(ev.target.value + 1)}
						>
							{slides.map((s, i) => {
								let text = `Slide ${i + 1}`
								s.title && (text +=	`: ${s.title}`);

								return (
									<MenuItem key={s.id} value={i}>
										<ListItem sx={[ !s.visible && { '& > div': { color: (theme) => theme.palette.grey[500] + '!important' } } ]}>
											<ListItemIcon>{s.visible ? <VisibilityIcon /> : <VisibilityOffIcon />}</ListItemIcon>
											<ListItemText>
												<Typography variant='body1'>{text}</Typography>
												{s.scene && <Typography variant='caption'>{s.scene}</Typography>}
											</ListItemText>
										</ListItem>
									</MenuItem>
								);
							})}
						</Select>
					</Grid>
					<Grid item xs={2} sx={{ textAlign: 'center' }}>
						<IconButton
							aria-label='all slides'
							size='large'
							onClick={() => setOverviewOpen(true)}
						>
							<AppsIcon fontSize='inherit' />
						</IconButton>
					</Grid>
				</Grid>
				<Card>
					<CardMedia
						component='img'
						image={imgCache[slide.id] || cacheImage(slide.id)}
						alt='current slide preview'
					/>
				</Card>
				<Stack direction='row' spacing={2}>
					<Card
						sx={[ !prev && { visibility: 'hidden' } ]}
						onClick={prevSlide}
					>
						<CardActionArea>
							<CardMedia
								component='img'
								image={prev ? (imgCache[prev.id] || cacheImage(prev.id)) : imgCache[slide.id]}
								alt='prev slide preview'
							/>
							<CardContent>
								<Typography variant='button'>
									Prev
								</Typography>
								<Typography variant='caption'>
									{prev && prev.scene && ` (${prev.scene})`}
								</Typography>
							</CardContent>
						</CardActionArea>
					</Card>
					<Card
						sx={[ !next && { visibility: 'hidden' } ]}
						onClick={nextSlide}
					>
						<CardActionArea>
							<CardMedia
								component='img'
								image={next ? (imgCache[next.id] || cacheImage(next.id)) : imgCache[slide.id]}
								alt='next slide preview'
							/>
							<CardContent>
								<Typography variant='button'>
									Next
								</Typography>
								<Typography variant='caption'>
									{next && next.scene && ` (${next.scene})`}
								</Typography>
							</CardContent>
						</CardActionArea>
					</Card>
				</Stack>
				<Paper
					elevation={0}
					sx={{
						backgroundColor: 'inherit!important',
						'& > div *': {
							backgroundColor: 'inherit!important',
							color: (theme) => theme.palette.text.primary + '!important',
						},
					}}
				>
					<div dangerouslySetInnerHTML={{ __html: slide.notesHtml }} />
				</Paper>
			</Stack>
		</Paper>
	);
};

async function postData(url = '', data = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    body: JSON.stringify(data),
  });
  return response.json();
}

const Page = () => {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

	useEffect(() => (async () => {
	})(), []);

	const handleChange = useCallback(debounce(async (ev) => {
		setError('');
		const { value } = ev.target;

		try {
			const response = await postData('https://oauth2.googleapis.com/token', {
				client_id,
				client_secret,
				code: value,
				grant_type: 'authorization_code',
				redirect_uri,
			});

			response.access_token && setToken(response.access_token);
			response.error && setError(response.error);
		} catch (err) {
			setError(err);
		}
		
	}, 500), [])

	return <Paper elevation={0} sx={{ maxWidth: 550, mx: 'auto' }}>
		<Stack alignItems='center'>
			{token === '' ? (<>
				<Typography variant='h6'>
					To authorize, please paste the following link in your browser:<br />
					<Typography variant='caption'>{oauthUrl}</Typography><br />
					Then, paste the resulting code in the field below.
				</Typography><br />
				<TextField
					fullWidth
					error={error !== ''}
					label='OAuth Token'
					onChange={handleChange}
					helperText={error}
				/>
			</>) : <App token={token} />}
		</Stack>
	</Paper>
};

export default Page;
