import * as React from 'react';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import CardActionArea from '@mui/material/CardActionArea';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

const Overview = ({ slides, imgCache, placeholder, onClick }) => {
  return (
    <Grid container spacing={2}>
      {slides.map((slide, i) => (
        <Grid key={slide.id} item xs={4}>
          <Card onClick={() => onClick(i)}>
            <CardActionArea>
              <CardMedia
                component='img'
                image={imgCache[slide.id] || placeholder}
                alt={`slide ${slide.id} preview`}
              />
              <CardContent>
                {`Slide ${i + 1}${slide.title ? ': ' + slide.title : ''}`}
                <Typography variant='caption'>
                  {slide.scene && ` (${slide.scene})`}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default Overview;
