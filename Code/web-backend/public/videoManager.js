//load the videos for the given user
async function fetchVideos() {
    try {
      const response = await fetch('/api/videos', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const { videos, isAdmin } = data;
      populateVideoList(videos, isAdmin);
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
}
  
function populateVideoList(videos, isAdmin) {
  const videoList = document.getElementById('video-list');
  videoList.innerHTML = '';

  if (videos.length === 0) {
    videoList.innerText = 'No videos uploaded yet.';
    return;
  }

  videos.forEach(video => {
    const videoItem = document.createElement('div');
    videoItem.className = 'video-item bg-white shadow-lg rounded-lg p-4 m-4 flex flex-col items-center';

    const videoTitle = document.createElement('h2');
    videoTitle.className = 'text-lg font-bold mb-2';
    videoTitle.innerText = video.title;

    const videoPlayer = document.createElement('video');
    videoPlayer.className = 'mb-4 w-full';

    fetchVideoUrl(video.filepath, videoPlayer);

    videoPlayer.controls = true;


    const actionContainer = document.createElement('div');
    actionContainer.className = 'action-buttons flex space-x-4';

    const processButton = document.createElement('button');
    processButton.className = 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded';
    if (video.summary_file_id) {
      processButton.innerText = 'View Summary';
      processButton.onclick = () => toggleSummary(video.id, processButton);
    } else {
      processButton.innerText = video.status === 'processing' ? 'Processing...' : 'Generate Summary';
      processButton.disabled = video.status === 'processing';
      processButton.onclick = () => startProcessing(video.id, processButton);
    }

    actionContainer.appendChild(processButton);


    if (isAdmin) {
      const deleteButton = document.createElement('button');
      deleteButton.className = 'bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded';
      deleteButton.innerText = 'Delete Video';
      deleteButton.onclick = () => deleteVideo(video.id, videoItem);
      actionContainer.appendChild(deleteButton);
    }

    const summaryDiv = document.createElement('div');
    summaryDiv.id = `summary-${video.id}`;
    summaryDiv.className = 'summary hidden mt-4 p-4 bg-gray-100 rounded-lg w-full text-left';

    videoItem.appendChild(videoTitle);
    videoItem.appendChild(videoPlayer);
    videoItem.appendChild(actionContainer);
    videoItem.appendChild(summaryDiv);

    videoList.appendChild(videoItem);
  });
}
  
async function deleteVideo(videoId, videoElement) {
  if (!confirm('Are you sure you want to delete this video?')) {
    return;
  }

  try {
    const response = await fetch(`/api/videos/${videoId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message);
    }
    videoElement.remove();

    alert('Video Deleted');
  } catch (error) {
    alert('Video could not be deleted');
  }
}

//get the vdieo for the player
async function fetchVideoUrl(filepath, videoPlayer) {
    try {
        const response = await fetch(`/api/video-url?filepath=${encodeURIComponent(filepath)}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        videoPlayer.src = data.url;
    } catch (error) {
        console.error(error);
    }
}
//get the summary for the video once processed
async function toggleSummary(videoId, button) {
    const summaryDiv = document.getElementById(`summary-${videoId}`);

    if (summaryDiv.classList.contains('hidden')) {
        try {

            const response = await fetch(`/api/summary-url?videoId=${videoId}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('failed to load summary');
            }
            const data = await response.json();
            const summaryResponse = await fetch(data.url);
            const summaryText = await summaryResponse.text();
            summaryDiv.innerText = summaryText;
            summaryDiv.classList.remove('hidden');
            button.innerText = 'Hide Summary';
        } catch (error) {
            console.error(error);
        }
    } else {
        summaryDiv.classList.add('hidden');
        button.innerText = 'View Summary';
    }
}

async function startProcessing(videoId, button) {
    try {
        button.innerText = 'Processing...';
        button.disabled = true;

        const response = await fetch(`/api/process/${videoId}`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`${response.status}`);
        }

        const pollInterval = 5000;
        const pollStatus = async () => {
            try {
                const statusResponse = await fetch(`/api/status/${videoId}`, {
                    credentials: 'include'
                });

                if (!statusResponse.ok) {
                    throw new Error(`${statusResponse.status}`);
                }

                const statusData = await statusResponse.json();
                if (statusData.status === 'completed') {
                    button.innerText = 'View Summary';
                    button.disabled = false;
                    button.onclick = () => toggleSummary(videoId, button);
                } else {
                    setTimeout(pollStatus, pollInterval);
                }
            } catch (statusError) {
                setTimeout(pollStatus, pollInterval);
            }
        };

        pollStatus();

    } catch (error) {
        button.innerText = 'Generate Summary';
        button.disabled = false;
    }
}

window.onload = fetchVideos;

